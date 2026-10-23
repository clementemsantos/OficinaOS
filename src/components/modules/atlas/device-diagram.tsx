import type { AtlasCategory } from "@/lib/repair-atlas";

/** Diagramas próprios e esquemáticos. A localização real varia por modelo. */
export function DeviceDiagram({ category }: { category: AtlasCategory }) {
  if (!["phone", "tablet", "laptop", "desktop"].includes(category)) {
    return null;
  }
  const phone = category === "phone" || category === "tablet";
  return (
    <figure className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4 sm:p-6">
      <svg
        aria-label={
          phone
            ? "Representação ilustrativa de bateria, placa principal, câmaras e porta de carregamento"
            : "Representação ilustrativa de placa principal, ventoinha, memória, armazenamento e bateria"
        }
        className="mx-auto h-auto w-full max-w-xl"
        role="img"
        viewBox="0 0 640 345"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="atlas-board-grad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#1c7266" />
            <stop offset="1" stopColor="#09483f" />
          </linearGradient>
        </defs>
        {phone ? (
          <>
            <rect
              fill="#272c36"
              height="300"
              rx="27"
              stroke="#93a3af"
              strokeWidth="3"
              width="250"
              x="150"
              y="20"
            />
            <rect
              fill="#e5e9eb"
              height="263"
              rx="12"
              width="222"
              x="164"
              y="38"
            />
            <rect
              fill="url(#atlas-board-grad)"
              height="90"
              rx="9"
              width="204"
              x="173"
              y="48"
            />
            <rect
              fill="#152f31"
              height="55"
              rx="5"
              stroke="#88a69f"
              strokeWidth="2"
              width="55"
              x="187"
              y="58"
            />
            <rect fill="#182a2e" height="24" rx="3" width="30" x="259" y="59" />
            <rect fill="#182a2e" height="24" rx="3" width="30" x="299" y="59" />
            <circle
              cx="349"
              cy="76"
              fill="#1a2832"
              r="15"
              stroke="#d1dce0"
              strokeWidth="4"
            />
            <rect
              fill="#6e8793"
              height="116"
              rx="10"
              width="166"
              x="192"
              y="148"
            />
            <rect
              fill="#c8d4d9"
              height="88"
              rx="6"
              width="148"
              x="201"
              y="160"
            />
            <path d="M213 204h25m-12-12v24" stroke="#75858d" strokeWidth="3" />
            <rect
              fill="#677c86"
              height="15"
              rx="6"
              width="57"
              x="252"
              y="276"
            />
            <rect fill="#101820" height="8" rx="3" width="32" x="263" y="301" />
            <g fill="none" stroke="#c67e2f" strokeWidth="2">
              <path d="M380 84H483" />
              <path d="M358 209H483" />
              <path d="M297 306H483" />
              <path d="M171 105H66" />
            </g>
            <g fill="currentColor" fontSize="15" fontWeight="600">
              <text x="485" y="79">
                Câmaras
              </text>
              <text x="485" y="204">
                Bateria
              </text>
              <text x="485" y="301">
                Porta de carga
              </text>
              <text x="12" y="99">
                Placa principal
              </text>
            </g>
          </>
        ) : (
          <>
            <rect
              fill="#26343e"
              height="278"
              rx="17"
              stroke="#8fa4b2"
              strokeWidth="3"
              width="500"
              x="65"
              y="28"
            />
            <rect
              fill="#dee5e8"
              height="246"
              rx="10"
              width="472"
              x="79"
              y="44"
            />
            <rect
              fill="url(#atlas-board-grad)"
              height="130"
              rx="8"
              width="272"
              x="99"
              y="60"
            />
            <circle
              cx="160"
              cy="115"
              fill="#233943"
              r="46"
              stroke="#a5b8c1"
              strokeWidth="5"
            />
            <circle cx="160" cy="115" fill="#556b78" r="21" />
            <path
              d="M160 73l-20 31 40 22-20-53Zm0 84l-20-31 40-22-20 53Z"
              fill="#7f9ca6"
            />
            <rect
              fill="#15343a"
              height="34"
              rx="5"
              stroke="#a2b7b4"
              strokeWidth="2"
              width="100"
              x="240"
              y="86"
            />
            <rect fill="#6aadb4" height="23" rx="4" width="86" x="247" y="92" />
            <rect
              fill="#162c2b"
              height="19"
              rx="4"
              width="106"
              x="240"
              y="139"
            />
            <rect
              fill="#c4d1d7"
              height="95"
              rx="10"
              stroke="#647b8a"
              strokeWidth="2"
              width="135"
              x="387"
              y="62"
            />
            <rect
              fill="#eff4f4"
              height="63"
              rx="5"
              width="111"
              x="399"
              y="75"
            />
            <rect
              fill="#6a8190"
              height="58"
              rx="7"
              width="421"
              x="100"
              y="208"
            />
            <rect
              fill="#c8d4db"
              height="35"
              rx="4"
              width="383"
              x="119"
              y="219"
            />
            <g fill="none" stroke="#c67e2f" strokeWidth="2">
              <path d="M160 65V15H102" />
              <path d="M296 86V15H355" />
              <path d="M455 65V15H505" />
              <path d="M313 267V329H385" />
            </g>
            <g fill="currentColor" fontSize="14" fontWeight="600">
              <text x="9" y="19">
                Ventilação
              </text>
              <text x="357" y="19">
                Memória
              </text>
              <text x="507" y="19">
                Armazenamento
              </text>
              <text x="391" y="334">
                Bateria / fonte
              </text>
            </g>
          </>
        )}
      </svg>
      <figcaption className="mt-3 text-center text-on-surface-variant text-xs">
        Diagrama didático genérico — não representa a disposição de componentes
        de nenhum modelo. Consultar sempre a documentação específica do
        fabricante.
      </figcaption>
    </figure>
  );
}
