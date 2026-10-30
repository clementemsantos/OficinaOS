import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

interface ConnectionStatus {
  google: {
    configured: boolean;
    connected: boolean;
    connectedAt: string | null;
  };
  mailImport: {
    enabled: boolean;
    hasError: boolean;
    lastSyncAt: string | null;
  };
  messenger: { connected: boolean; setupRequired: boolean };
  whatsapp: { connected: boolean; setupRequired: boolean };
}

interface GoogleOverview {
  calendar: Array<{ id: string; start: string; title: string }>;
  googleTasks: Array<{ id: string; due: string | null; title: string }>;
  unreadMailEstimate: number | null;
}

function formatDate(value: string): string {
  if (!value) {
    return "Sem hora definida";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("pt-PT", {
    dateStyle: "medium",
    timeStyle: value.length === 10 ? undefined : "short",
  });
}

function ChannelLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <a
      className="flex min-h-20 flex-col justify-center rounded-xl border border-outline-variant bg-surface-container-lowest p-4 transition-colors hover:bg-surface-container"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <strong className="text-on-surface">{label}</strong>
      <span className="mt-1 text-on-surface-variant text-xs">
        {description}
      </span>
    </a>
  );
}

export default function InovitoMobilePage() {
  const [connections, setConnections] = useState<ConnectionStatus | null>(null);
  const [googleData, setGoogleData] = useState<GoogleOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [error, setError] = useState<string | null>(null);
  let googleStatusText =
    "É necessário configurar o cliente OAuth Google no servidor.";
  if (connections?.google.connected) {
    googleStatusText = "Conta Google autorizada para leitura.";
  } else if (connections?.google.configured) {
    googleStatusText = "Pronto para pedir autorização à tua conta Google.";
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<ConnectionStatus>("/inovito/connections");
      setConnections(response.data);
      if (response.data.google.connected && response.data.google.configured) {
        try {
          const overview = await api.get<{ data: GoogleOverview }>(
            "/inovito/google/overview"
          );
          setGoogleData(overview.data.data);
        } catch {
          setGoogleData(null);
          setError(
            "A conta Google está ligada, mas não foi possível consultar os dados. Verifica a autorização."
          );
        }
      } else {
        setGoogleData(null);
      }
    } catch {
      setError("Não foi possível verificar as ligações do Inovito.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connectGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.get<{ url: string }>(
        "/inovito/google/connect"
      );
      // Destination is fixed by the backend to accounts.google.com.
      const destination = new URL(response.data.url);
      if (destination.origin !== "https://accounts.google.com") {
        throw new Error("Unexpected OAuth destination");
      }
      window.location.assign(destination.toString());
    } catch {
      setError(
        "Não foi possível iniciar a ligação Google. Verifica as credenciais OAuth do servidor."
      );
      setBusy(false);
    }
  };

  const disconnectGoogle = async () => {
    setBusy(true);
    try {
      await api.post("/inovito/google/disconnect");
      setConfirmDisconnect(false);
      await refresh();
    } catch {
      setError("Não foi possível desligar a conta Google.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <header className="space-y-2">
        <p className="font-semibold text-primary text-xs uppercase tracking-wide">
          Assistente pessoal e da Inove.pt
        </p>
        <h1 className="font-extrabold text-3xl text-on-surface">
          Inovito JARVIS
        </h1>
        <p className="text-on-surface-variant text-sm">
          Painel preparado para telemóvel. Os canais externos são de leitura ou
          acesso manual até serem autorizados e testados.
        </p>
      </header>

      {error && (
        <p
          className="rounded-xl border border-error/30 p-3 text-error text-sm"
          role="alert"
        >
          {error}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="font-bold text-lg text-on-surface">OficinaOS</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Link
            className="flex min-h-24 flex-col justify-center rounded-2xl bg-primary px-4 text-on-primary"
            to="/ai-analyst"
          >
            <strong>Conversar com a IA</strong>
            <span className="mt-1 text-xs">Assistente existente</span>
          </Link>
          <Link
            className="flex min-h-24 flex-col justify-center rounded-2xl bg-surface-container px-4"
            to="/tasks"
          >
            <strong>Tarefas da loja</strong>
            <span className="mt-1 text-on-surface-variant text-xs">
              Consultar e organizar
            </span>
          </Link>
          <Link
            className="flex min-h-24 flex-col justify-center rounded-2xl bg-surface-container px-4"
            to="/messages"
          >
            <strong>Mensagens</strong>
            <span className="mt-1 text-on-surface-variant text-xs">
              Histórico e importação de e-mail, se configurada
            </span>
          </Link>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-surface-container-low p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-lg">
            Google: e-mail, agenda e tarefas
          </h2>
          <Button
            disabled={loading || busy}
            onClick={refresh}
            size="sm"
            variant="secondary"
          >
            Atualizar
          </Button>
        </div>
        {loading && <p className="text-sm">A consultar as ligações…</p>}
        {!loading && connections && (
          <>
            <p className="text-on-surface-variant text-sm">
              {googleStatusText}
            </p>
            {!connections.google.connected && connections.google.configured && (
              <Button disabled={busy} onClick={connectGoogle}>
                Ligar conta Google
              </Button>
            )}
            {connections.google.connected && (
              <div className="space-y-2">
                {confirmDisconnect ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">
                      Confirmar remoção da ligação no OficinaOS?
                    </span>
                    <Button
                      disabled={busy}
                      onClick={disconnectGoogle}
                      size="sm"
                      variant="destructive"
                    >
                      Confirmar
                    </Button>
                    <Button
                      onClick={() => setConfirmDisconnect(false)}
                      size="sm"
                      variant="ghost"
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    disabled={busy}
                    onClick={() => setConfirmDisconnect(true)}
                    size="sm"
                    variant="secondary"
                  >
                    Desligar Google
                  </Button>
                )}
              </div>
            )}
          </>
        )}
        {googleData && (
          <div className="grid gap-4 md:grid-cols-2">
            <article className="space-y-2 rounded-xl bg-surface-container-lowest p-4">
              <h3 className="font-bold">Próximos eventos</h3>
              {googleData.calendar.length === 0 && (
                <p className="text-sm">
                  Sem eventos futuros na agenda principal.
                </p>
              )}
              {googleData.calendar.map((event) => (
                <p
                  className="border-outline-variant border-b pb-2 text-sm"
                  key={event.id}
                >
                  <strong>{event.title}</strong>
                  <span className="block text-on-surface-variant text-xs">
                    {formatDate(event.start)}
                  </span>
                </p>
              ))}
            </article>
            <article className="space-y-2 rounded-xl bg-surface-container-lowest p-4">
              <h3 className="font-bold">Google Tasks</h3>
              {googleData.googleTasks.length === 0 && (
                <p className="text-sm">
                  Sem tarefas abertas na primeira lista.
                </p>
              )}
              {googleData.googleTasks.map((task) => (
                <p
                  className="border-outline-variant border-b pb-2 text-sm"
                  key={task.id}
                >
                  <strong>{task.title}</strong>
                  {task.due && (
                    <span className="block text-on-surface-variant text-xs">
                      {formatDate(task.due)}
                    </span>
                  )}
                </p>
              ))}
            </article>
            <article className="rounded-xl bg-surface-container-lowest p-4 md:col-span-2">
              <h3 className="font-bold">Gmail</h3>
              <p className="mt-1 text-sm">
                Estimativa de mensagens não lidas:{" "}
                <strong>
                  {googleData.unreadMailEstimate ?? "indisponível"}
                </strong>
              </p>
              <p className="mt-1 text-on-surface-variant text-xs">
                Por segurança, o Inovito não lê o corpo das mensagens nesta
                fase.
              </p>
            </article>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold text-lg">Mensagens e canais externos</h2>
        {connections && (
          <p className="text-on-surface-variant text-sm">
            Importação IMAP do OficinaOS:{" "}
            {connections.mailImport.enabled ? "ativada" : "não ativada"}.
            {connections.mailImport.hasError && " Existe um erro a verificar."}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <ChannelLink
            description="Abrir Gmail. A ligação OAuth acima é apenas de leitura."
            href="https://mail.google.com/"
            label="Gmail"
          />
          <ChannelLink
            description="Abrir a agenda da conta Google."
            href="https://calendar.google.com/"
            label="Google Calendar"
          />
          <ChannelLink
            description="Abrir as tuas listas de tarefas."
            href="https://tasks.google.com/"
            label="Google Tasks"
          />
          <ChannelLink
            description="Abrir WhatsApp; integração automática oficial por configurar."
            href="https://web.whatsapp.com/"
            label="WhatsApp"
          />
          <ChannelLink
            description="Abrir a caixa de entrada Meta. A integração Messenger está por configurar."
            href="https://business.facebook.com/latest/inbox/all"
            label="Facebook Messenger"
          />
        </div>
      </section>
      <section className="space-y-2 rounded-2xl border border-outline-variant p-4">
        <h2 className="font-bold text-lg">Adicionar ao ecrã inicial</h2>
        <p className="text-on-surface-variant text-sm">
          O OficinaOS já suporta aplicação web instalável. Num Android, abre o
          menu do Chrome e escolhe «Instalar aplicação». No iPhone, usa
          «Partilhar» e «Adicionar ao ecrã principal». É necessário um endereço
          HTTPS válido e acesso remoto seguro à tua instalação.
        </p>
        <p className="text-on-surface-variant text-xs">
          Não utilizar a instalação de produção sem corrigir as pendências de
          segurança e testar previamente a autenticação no telemóvel.
        </p>
      </section>
    </div>
  );
}
