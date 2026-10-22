#!/bin/sh
# Full off-server backup. Never delete remote history automatically.
set -eu
umask 077
export RCLONE_CONFIG="${RCLONE_CONFIG:-/config/rclone/rclone.conf}"
backup_root="${BACKUP_ROOT:-/backups}"
status_root="${STATUS_ROOT:-/status}"
upload_source="${UPLOAD_SOURCE:-/source/uploads}"
recovery_file="${RECOVERY_FILE:-/source/recovery.env}"
remote="${BACKUP_REMOTE:-oficina-crypt:}"
mkdir -p "$backup_root" "$status_root"
exec 9>"$backup_root/.lock"
if ! flock -n 9; then echo 'Another backup is running'; exit 1; fi
failed() {
  result=$?
  if [ "$result" -ne 0 ]; then date -u +%FT%TZ > "$status_root/last-failure.txt"; fi
}
trap failed EXIT
trap 'exit 1' HUP INT TERM
run_name="$(date -u +%Y%m%dT%H%M%SZ)-$(cat /proc/sys/kernel/random/uuid)"
run_dir="$backup_root/$run_name"
mkdir "$run_dir"
pg_dump --format=custom --no-owner --no-acl --file="$run_dir/database.dump"
pg_restore --list "$run_dir/database.dump" > /dev/null
# Includes private document files and photos. Secrets are included for recovery;
# only an encrypted crypt remote is accepted below.
tar -C "$upload_source" -czf "$run_dir/uploads.tar.gz" .
cp "$recovery_file" "$run_dir/recovery.env"
printf 'OficinaOS full backup\nUTC=%s\nPostgreSQL=16\n' "$run_name" > "$run_dir/manifest.txt"
(cd "$run_dir" && sha256sum database.dump uploads.tar.gz recovery.env manifest.txt > SHA256SUMS && sha256sum -c SHA256SUMS > /dev/null)
tar -tzf "$run_dir/uploads.tar.gz" > /dev/null
date -u +%FT%TZ > "$status_root/last-local.txt"
case "$remote" in
  *[!a-zA-Z0-9_:-]*|*:/*|*:*:*) echo 'Invalid crypt remote'; exit 1 ;;
esac
case "$remote" in *:) ;; *) echo 'Use a named crypt remote ending in a colon'; exit 1 ;; esac
# No passwords or rclone configuration are written to logs.
if ! rclone config show "${remote%:}" | grep -qx 'type = crypt'; then
  echo 'Configure an encrypted rclone crypt remote first'; exit 1
fi
drive_remote=$(rclone config show "${remote%:}" | sed -n 's/^remote = \([^:]*\):.*/\1/p')
case "$drive_remote" in ''|*[!a-zA-Z0-9_-]*) echo 'Invalid Google Drive remote'; exit 1 ;; esac
if ! rclone config show "$drive_remote" | grep -qx 'type = drive'; then
  echo 'The encrypted backup must target Google Drive'; exit 1
fi
rclone copy "$run_dir" "$remote$run_name" --retries 3 --low-level-retries 3
# Download verification checks remote decrypted bytes against all local files.
rclone check "$run_dir" "$remote$run_name" --download --one-way
date -u +%FT%TZ > "$status_root/last-remote-verified.txt.tmp"
mv "$status_root/last-remote-verified.txt.tmp" "$status_root/last-remote-verified.txt"
printf '%s\n' "$run_name" > "$status_root/last-remote-folder.txt"
# Only prune local, completed historical copies after online verification.
find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name '20*T*Z-*' -mtime +7 -exec rm -rf {} +
echo 'Backup uploaded and verified'
