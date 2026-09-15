type Building = {
  x: number
  y: number
  width: number
  height: number
}

const BUILDINGS: Building[] = [
  { x: 20, y: 430, width: 130, height: 470 },
  { x: 170, y: 330, width: 150, height: 570 },
  { x: 590, y: 370, width: 150, height: 530 },
  { x: 755, y: 480, width: 110, height: 420 },
]

function buildingWindows({ x, y, width, height }: Building) {
  const windows: { x: number; y: number }[] = []
  const columns = Math.floor((width - 24) / 34)
  const rows = Math.floor((height - 120) / 46)
  const offsetX = x + (width - columns * 34 + 12) / 2

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      windows.push({ x: offsetX + column * 34, y: y + 28 + row * 46 })
    }
  }

  return windows
}

/** Ilustração de capa (sem imagens externas) usando apenas tokens do tema. */
export function AuthCover() {
  return (
    <div className="relative hidden overflow-hidden bg-muted lg:block">
      <div className="absolute inset-0 bg-linear-to-br from-primary/10 via-muted to-background" />
      <svg
        aria-hidden="true"
        viewBox="0 0 880 900"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 size-full"
      >
        <circle cx="660" cy="220" r="110" className="fill-primary/5" />
        <circle cx="660" cy="220" r="64" className="fill-primary/10" />

        <g className="fill-foreground/5">
          {BUILDINGS.map((building) => (
            <rect
              key={`${building.x}-${building.y}`}
              x={building.x}
              y={building.y}
              width={building.width}
              height={building.height}
              rx="8"
            />
          ))}
        </g>
        <g className="fill-background/70">
          {BUILDINGS.flatMap((building) =>
            buildingWindows(building).map((window) => (
              <rect
                key={`${window.x}-${window.y}`}
                x={window.x}
                y={window.y}
                width="20"
                height="26"
                rx="3"
              />
            ))
          )}
        </g>

        <rect x="545" y="560" width="34" height="80" className="fill-primary/50" />
        <path d="M290 660 L450 520 L610 660 Z" className="fill-primary/80" />
        <rect x="320" y="650" width="260" height="250" className="fill-card" />
        <rect
          x="320"
          y="650"
          width="260"
          height="250"
          className="fill-none stroke-foreground/10"
          strokeWidth="2"
        />
        <rect x="348" y="700" width="62" height="54" rx="4" className="fill-primary/15" />
        <rect x="490" y="700" width="62" height="54" rx="4" className="fill-primary/15" />
        <rect x="422" y="772" width="56" height="128" rx="4" className="fill-primary/70" />
        <circle cx="466" cy="840" r="4" className="fill-card" />

        <rect x="222" y="800" width="12" height="100" className="fill-foreground/15" />
        <circle cx="228" cy="780" r="48" className="fill-primary/20" />
        <rect x="662" y="818" width="10" height="82" className="fill-foreground/15" />
        <circle cx="667" cy="800" r="38" className="fill-primary/20" />

        <rect x="0" y="892" width="880" height="8" className="fill-foreground/10" />
      </svg>

      <figure className="absolute inset-x-10 top-10 flex max-w-md flex-col gap-3 rounded-xl bg-background/80 p-6 ring-1 ring-foreground/10 backdrop-blur">
        <blockquote className="text-lg leading-snug font-medium text-balance">
          Do cadastro do imóvel ao contrato assinado, a imobiliária inteira num
          só lugar.
        </blockquote>
        <figcaption className="text-sm text-muted-foreground">
          Imóveis, clientes, agenda e portais conectados para toda a equipe.
        </figcaption>
      </figure>
    </div>
  )
}
