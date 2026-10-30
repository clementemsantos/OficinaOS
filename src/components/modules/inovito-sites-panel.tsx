import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

interface SiteSnapshot {
  id: string;
  name: string;
  online: boolean;
  origin: string;
  products: Array<{
    id: number;
    name: string;
    permalink: string;
    price: string | null;
  }>;
}

interface SitesResponse {
  orderImport: {
    configured: boolean;
    enabled: boolean;
    hasError: boolean;
    lastSyncAt: string | null;
    note: string;
  };
  sites: SiteSnapshot[];
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data indisponível"
    : date.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });
}

export default function InovitoSitesPanel() {
  const [sites, setSites] = useState<SitesResponse | null>(null);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [sitesError, setSitesError] = useState(false);

  const refreshSites = useCallback(async () => {
    setSitesLoading(true);
    setSitesError(false);
    try {
      const response = await api.get<SitesResponse>("/inovito/sites");
      setSites(response.data);
    } catch {
      setSitesError(true);
    } finally {
      setSitesLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSites();
  }, [refreshSites]);


  return (
      <section className="space-y-3 rounded-2xl bg-surface-container-low p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-lg">Os meus sites</h2>
            <p className="text-on-surface-variant text-xs">
              Catálogo público consultado em tempo real; nunca altera os
              produtos, preços ou encomendas do WordPress.
            </p>
          </div>
          <Button
            disabled={sitesLoading}
            onClick={refreshSites}
            size="sm"
            variant="secondary"
          >
            Atualizar sites
          </Button>
        </div>
        {sitesLoading && <p className="text-sm">A consultar os sites…</p>}
        {sitesError && (
          <p className="text-sm" role="alert">
            Não foi possível consultar o estado dos sites neste momento.
          </p>
        )}
        {sites?.sites.map((site) => (
          <article
            className="space-y-3 rounded-xl bg-surface-container-lowest p-4"
            key={site.id}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold">{site.name}</h3>
                <p className="text-on-surface-variant text-xs">
                  {site.online
                    ? "Catálogo público disponível"
                    : "Não foi possível consultar o catálogo"}
                </p>
              </div>
              <a
                className="text-primary text-sm underline"
                href={site.origin}
                rel="noopener noreferrer"
                target="_blank"
              >
                Abrir site
              </a>
            </div>
            {site.products.length === 0 && site.online && (
              <p className="text-on-surface-variant text-sm">
                Sem produtos publicados devolvidos nesta consulta.
              </p>
            )}
            {site.products.map((product) => (
              <div
                className="flex items-center justify-between gap-2 border-outline-variant border-b pb-2 text-sm"
                key={product.id}
              >
                <a
                  className="min-w-0 truncate text-on-surface underline"
                  href={product.permalink}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {product.name}
                </a>
                <strong className="shrink-0">{product.price ?? "—"}</strong>
              </div>
            ))}
          </article>
        ))}
        {sites?.orderImport && (
          <p className="text-on-surface-variant text-xs">
            Importador de encomendas WooCommerce do OficinaOS:{" "}
            {sites.orderImport.enabled ? "ativado" : "não ativado"}.
            {sites.orderImport.lastSyncAt && (
              <>
                {" "}Última sincronização:{" "}
                {formatDate(sites.orderImport.lastSyncAt)}.
              </>
            )}
            {sites.orderImport.hasError && " Existe um erro a verificar."}
            {" "}Atualmente, o importador de encomendas suporta uma única loja.
          </p>
        )}
        <p className="text-on-surface-variant text-xs">
          Outros sites WordPress/WooCommerce podem ser adicionados à lista
          autorizada do servidor, sem publicar uma nova versão da app.
        </p>
      </section>
  );
}
