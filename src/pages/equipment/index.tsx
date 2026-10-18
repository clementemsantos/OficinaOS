import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";

interface EquipmentItem {
  brand: string | null;
  category: string | null;
  customer: { id: string; name: string } | null;
  id: string;
  model: string | null;
  serialNumber: string | null;
  sourceId: string;
  sourceSystem: string;
}

interface PageResult {
  items: EquipmentItem[];
  page: number;
  pageSize: number;
  total: number;
}

export default function EquipmentPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<PageResult>("/equipment", { params: { page, search } })
      .then((response) => {
        if (active) {
          setResult(response.data);
          setError("");
        }
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível carregar os equipamentos.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [page, search]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-bold font-headline text-2xl text-on-surface">
          Equipamentos
        </h1>
        <p className="mt-1 text-on-surface-variant text-sm">
          Equipamentos físicos da loja, incluindo referências históricas do Keymaster.
          A associação a clientes em falta deve ser confirmada manualmente.
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSearch(query);
        }}
      >
        <Input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pesquisar marca, modelo, série ou referência"
          value={query}
        />
        <Button size="sm" submit type="submit">
          Pesquisar
        </Button>
      </form>
      {error && <p className="text-error text-sm">{error}</p>}
      {loading && <p className="text-on-surface-variant">A carregar...</p>}
      {result && (
        <>
          <p className="text-on-surface-variant text-sm">
            {result.total} equipamentos
          </p>
          <div className="overflow-x-auto rounded-xl bg-surface-container-low p-3">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-outline-variant border-b">
                  <th className="p-2">Referência</th>
                  <th className="p-2">Equipamento</th>
                  <th className="p-2">N.º de série</th>
                  <th className="p-2">Cliente</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr className="border-outline-variant border-b" key={item.id}>
                    <td className="p-2">{item.sourceSystem}: {item.sourceId}</td>
                    <td className="p-2">
                      {[item.brand, item.model].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="p-2">{item.serialNumber || "—"}</td>
                    <td className="p-2">
                      {item.customer ? (
                        <Link className="text-primary underline" to={`/customers/${item.customer.id}`}>
                          {item.customer.name}
                        </Link>
                      ) : (
                        "Por associar"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={loading || page === 1}
              onClick={() => setPage((n) => n - 1)}
              size="sm"
              type="button"
              variant="secondary"
            >
              Anterior
            </Button>
            <Button
              disabled={loading || page * result.pageSize >= result.total}
              onClick={() => setPage((n) => n + 1)}
              size="sm"
              type="button"
              variant="secondary"
            >
              Seguinte
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
