import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";

interface Site {
  id: string;
  origin: string;
}

interface OrderPreview {
  id: number;
  number: string;
  status: string;
  total: string;
  dateModified: string | null;
}

interface Props {
  sites: Site[];
  enabled: boolean;
  connectedOrigins: string[];
  onChanged: () => void;
}

export default function InovitoWooPrivatePanel({
  sites,
  enabled,
  connectedOrigins,
  onChanged,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    origin: string;
    data: OrderPreview[];
  } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const connect = async (origin: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.post("/inovito/sites/private", { origin, key, secret });
      setEditing(null);
      onChanged();
    } catch {
      setError("A ligação falhou. Confirma a chave e as permissões de leitura.");
    } finally {
      setKey("");
      setSecret("");
      setBusy(false);
    }
  };

  const readOrders = async (site: Site) => {
    setBusy(true);
    setPreview(null);
    setError(null);
    try {
      const result = await api.get<{ origin: string; data: OrderPreview[] }>(
        `/inovito/sites/private/${encodeURIComponent(site.id)}/preview`
      );
      setPreview(result.data);
    } catch {
      setError("Não foi possível consultar encomendas. Revê as credenciais.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (site: Site) => {
    setBusy(true);
    try {
      await api.delete(
        `/inovito/sites/private/${encodeURIComponent(site.id)}`
      );
      setConfirmRemove(null);
      setPreview(null);
      onChanged();
    } catch {
      setError("Não foi possível remover esta ligação.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-outline-variant p-3">
      <div>
        <h3 className="font-semibold">Encomendas WooCommerce — consulta privada</h3>
        <p className="mt-1 text-on-surface-variant text-xs">
          É necessária uma chave WooCommerce com acesso apenas de leitura.
          As credenciais são cifradas no servidor. Não são alterados
          produtos, stock ou encomendas.
        </p>
      </div>
      {!enabled && (
        <p className="text-on-surface-variant text-sm">
          A ligação privada está desligada neste servidor de testes. O
          administrador terá de ativar INOVITO_WOO_PRIVATE_ENABLED.
        </p>
      )}
      {error && (
        <p className="text-error text-sm" role="alert">
          {error}
        </p>
      )}
      {sites.map((site) => {
        const connected = connectedOrigins.includes(site.origin);
        return (
          <div className="space-y-2 border-outline-variant border-t pt-3" key={site.id}>
            <p className="font-semibold text-sm">
              {site.id} — {connected ? "Ligação guardada" : "Sem chave privada"}
            </p>
            {enabled && !connected && editing !== site.origin && (
              <Button
                disabled={busy}
                onClick={() => {
                  setEditing(site.origin);
                  setError(null);
                }}
                size="sm"
                variant="secondary"
              >
                Configurar acesso de leitura
              </Button>
            )}
            {enabled && editing === site.origin && (
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  connect(site.origin);
                }}
              >
                <Input
                  aria-label={`Consumer Key de ${site.id}`}
                  autoComplete="off"
                  onChange={(event) => setKey(event.target.value)}
                  placeholder="Consumer Key (ck_…)"
                  required
                  type="password"
                  value={key}
                />
                <Input
                  aria-label={`Consumer Secret de ${site.id}`}
                  autoComplete="off"
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder="Consumer Secret (cs_…)"
                  required
                  type="password"
                  value={secret}
                />
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy || !key || !secret} size="sm" type="submit">
                    Testar e guardar
                  </Button>
                  <Button
                    onClick={() => {
                      setEditing(null);
                      setKey("");
                      setSecret("");
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            )}
            {enabled && connected && (
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  onClick={() => readOrders(site)}
                  size="sm"
                  variant="secondary"
                >
                  Consultar últimas encomendas
                </Button>
                {confirmRemove === site.origin ? (
                  <>
                    <Button
                      disabled={busy}
                      onClick={() => disconnect(site)}
                      size="sm"
                      variant="destructive"
                    >
                      Confirmar desligar
                    </Button>
                    <Button
                      onClick={() => setConfirmRemove(null)}
                      size="sm"
                      variant="ghost"
                    >
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setConfirmRemove(site.origin)}
                    size="sm"
                    variant="ghost"
                  >
                    Desligar ligação
                  </Button>
                )}
              </div>
            )}
            {preview?.origin === site.origin && (
              <div className="space-y-1 text-sm">
                {preview.data.length === 0 && (
                  <p>Sem encomendas devolvidas na consulta.</p>
                )}
                {preview.data.map((order) => (
                  <p className="border-outline-variant border-b py-1" key={order.id}>
                    #{order.number} · {order.status} · {order.total}
                  </p>
                ))}
                <p className="text-on-surface-variant text-xs">
                  Apenas cinco encomendas recentes. Não inclui nomes ou
                  contactos de clientes. Nenhuma importação foi executada.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
