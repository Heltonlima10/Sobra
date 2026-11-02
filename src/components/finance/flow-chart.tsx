import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { buildCashflow, flowCaption, type Cashflow, type FlowRole } from "@/lib/finance/flow";
import { formatBRL, type MonthSnapshot } from "@/lib/finance/model";

const FILL: Record<FlowRole, string> = {
  in: "fill-ink",
  gap: "fill-danger",
  need: "fill-ink",
  want: "fill-danger",
  save: "fill-good",
  room: "fill-good",
};

const MONEY: Record<FlowRole, string> = {
  in: "fill-muted",
  gap: "fill-danger",
  need: "fill-muted",
  want: "fill-danger",
  save: "fill-good",
  room: "fill-good",
};

const LEGEND: { role: FlowRole; label: string; dot: string }[] = [
  { role: "need", label: "Essencial", dot: "bg-ink" },
  { role: "want", label: "Vontade", dot: "bg-danger" },
  { role: "save", label: "Guardar", dot: "bg-good" },
  { role: "room", label: "Sobra", dot: "bg-good" },
  { role: "gap", label: "Faltou", dot: "bg-danger" },
];

type Box = {
  index: number;
  x: number;
  y: number;
  h: number;
  value: number;
  name: string;
  role: FlowRole;
};

type Ribbon = {
  sourceName: string;
  targetName: string;
  value: number;
  role: FlowRole;
  sy: number;
  sh: number;
  ty: number;
  th: number;
  sx: number;
  tx: number;
};

type SideLabel = {
  x: number;
  top: number;
  name: string;
  money: string;
  role: FlowRole;
  anchor: "start" | "end";
  barX: number;
  barMid: number;
};

type ChartLayout = {
  height: number;
  nodeW: number;
  boxes: Box[];
  ribbons: Ribbon[];
  left: SideLabel[];
  right: SideLabel[];
  hub: Box;
  hubY: number;
};

function shortMoney(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

function clipName(name: string, max: number): string {
  if (name.length <= max) return name;
  return `${name.slice(0, Math.max(1, max - 1))}…`;
}

function nodeValue(flow: Cashflow, index: number): number {
  let inbound = 0;
  let outbound = 0;
  for (const link of flow.links) {
    if (link.source === index) outbound += link.value;
    if (link.target === index) inbound += link.value;
  }
  return Math.max(inbound, outbound);
}

function layoutChart(flow: Cashflow, width: number): ChartLayout {
  const narrow = width < 440;
  const nodeW = narrow ? 14 : 18;
  const gap = 14;
  const padX = Math.min(narrow ? 102 : 128, Math.max(78, Math.floor(width * 0.3)));
  const padY = 22;
  const labelH = 30;
  const nameMax = Math.max(8, Math.floor((padX - 14) / 6.6));

  const sourceIdx = Array.from({ length: flow.sourceCount }, (_, index) => index);
  const hubIdx = flow.sourceCount;
  const destIdx = Array.from(
    { length: flow.nodes.length - flow.sourceCount - 1 },
    (_, index) => flow.sourceCount + 1 + index,
  );
  const columns = [sourceIdx, [hubIdx], destIdx];
  const maxCount = Math.max(...columns.map((column) => column.length), 1);
  const slot = narrow ? 46 : 52;
  const inner = Math.max(210, maxCount * slot + (maxCount - 1) * gap);
  const maxTotal = Math.max(
    ...columns.map((column) => column.reduce((sum, index) => sum + nodeValue(flow, index), 0)),
    1,
  );
  const scale = (inner - (maxCount - 1) * gap) / maxTotal;
  const span = Math.max(36, width - padX * 2 - nodeW);
  const xs = [padX, padX + span / 2, width - padX - nodeW];

  const boxes: Box[] = [];
  columns.forEach((column, columnIndex) => {
    const heights = column.map((index) => Math.max(3, nodeValue(flow, index) * scale));
    const totalH = heights.reduce((sum, height) => sum + height, 0);
    let y = padY + (inner - totalH - (column.length - 1) * gap) / 2;
    column.forEach((index, row) => {
      const node = flow.nodes[index];
      const h = heights[row] ?? 3;
      if (!node) return;
      boxes.push({
        index,
        x: xs[columnIndex] ?? padX,
        y,
        h,
        value: nodeValue(flow, index),
        name: node.name,
        role: node.role,
      });
      y += h + gap;
    });
  });

  const byIndex = new Map(boxes.map((box) => [box.index, box]));
  const sourceOffset = new Map<number, number>();
  const targetOffset = new Map<number, number>();
  const ribbons: Ribbon[] = [...flow.links]
    .filter((link) => link.value > 0)
    .sort((a, b) => {
      const ay = byIndex.get(a.source)?.y ?? 0;
      const by = byIndex.get(b.source)?.y ?? 0;
      if (ay !== by) return ay - by;
      return (byIndex.get(a.target)?.y ?? 0) - (byIndex.get(b.target)?.y ?? 0);
    })
    .flatMap((link) => {
      const source = byIndex.get(link.source);
      const target = byIndex.get(link.target);
      if (!source || !target || source.value <= 0 || target.value <= 0) return [];
      const sh = (link.value / source.value) * source.h;
      const th = (link.value / target.value) * target.h;
      const sy = source.y + (sourceOffset.get(source.index) ?? 0);
      const ty = target.y + (targetOffset.get(target.index) ?? 0);
      sourceOffset.set(source.index, (sourceOffset.get(source.index) ?? 0) + sh);
      targetOffset.set(target.index, (targetOffset.get(target.index) ?? 0) + th);
      return [
        {
          sourceName: source.name,
          targetName: target.name,
          value: link.value,
          role: target.role,
          sy,
          sh,
          ty,
          th,
          sx: source.x + nodeW,
          tx: target.x,
        },
      ];
    });

  function sideLabels(indices: number[], side: "left" | "right"): SideLabel[] {
    const labels = indices.flatMap((index) => {
      const box = byIndex.get(index);
      if (!box) return [];
      return [
        {
          x: side === "left" ? box.x - 8 : box.x + nodeW + 8,
          top: box.y + box.h / 2 - labelH / 2,
          name: clipName(box.name, nameMax),
          money: shortMoney(box.value),
          role: box.role,
          anchor: side === "left" ? ("end" as const) : ("start" as const),
          barX: side === "left" ? box.x : box.x + nodeW,
          barMid: box.y + box.h / 2,
        },
      ];
    });
    labels.sort((a, b) => a.top - b.top);
    for (let index = 1; index < labels.length; index += 1) {
      const prev = labels[index - 1];
      const current = labels[index];
      if (!prev || !current) continue;
      const min = prev.top + labelH + 3;
      if (current.top < min) current.top = min;
    }
    return labels;
  }

  const left = sideLabels(sourceIdx, "left");
  const right = sideLabels(destIdx, "right");
  const hub = byIndex.get(hubIdx) ?? boxes[0];
  if (!hub) {
    return { height: 180, nodeW, boxes, ribbons, left, right, hub: boxes[0] as Box, hubY: 12 };
  }
  const hubY = hub.y >= 18 ? hub.y - 8 : hub.y + hub.h + 16;
  const lowest = Math.max(
    padY + inner + 12,
    hubY + 8,
    ...left.map((label) => label.top + labelH + 6),
    ...right.map((label) => label.top + labelH + 6),
  );

  return { height: lowest, nodeW, boxes, ribbons, left, right, hub, hubY };
}

function ribbonPath(ribbon: Ribbon): string {
  const mid = (ribbon.sx + ribbon.tx) / 2;
  return [
    `M ${ribbon.sx},${ribbon.sy}`,
    `C ${mid},${ribbon.sy} ${mid},${ribbon.ty} ${ribbon.tx},${ribbon.ty}`,
    `L ${ribbon.tx},${ribbon.ty + ribbon.th}`,
    `C ${mid},${ribbon.ty + ribbon.th} ${mid},${ribbon.sy + ribbon.sh} ${ribbon.sx},${ribbon.sy + ribbon.sh}`,
    "Z",
  ].join(" ");
}

export function FlowChart({
  snapshot,
  flow: flowOverride,
  caption,
}: {
  snapshot?: MonthSnapshot;
  flow?: Cashflow | null;
  caption?: string;
}) {
  const titleId = useId();
  const flow = useMemo(() => {
    if (flowOverride !== undefined) return flowOverride;
    return snapshot ? buildCashflow(snapshot) : null;
  }, [flowOverride, snapshot]);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [tip, setTip] = useState<{ x: number; y: number; label: string; value: number } | null>(null);
  const layout = useMemo(() => (flow && width > 0 ? layoutChart(flow, width) : null), [flow, width]);

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => {
      const next = node.clientWidth;
      if (next > 0) setWidth(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [flow]);

  if (!flow) {
    return <p className="mt-3 text-sm text-muted">Nenhuma saída neste mês. A primeira anotação já mostra o rastro.</p>;
  }

  const roles = new Set(flow.nodes.map((node) => node.role));
  const legend = LEGEND.filter((item) => roles.has(item.role));
  const note = caption ?? (snapshot ? flowCaption(flow, snapshot) : "");

  function showTip(event: PointerEvent<SVGElement>, label: string, value: number) {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      label,
      value,
    });
  }

  return (
    <figure className="mt-3">
      <div ref={box} className="relative w-full">
        {layout ? (
        <>
        <svg
          width={width}
          height={layout.height}
          viewBox={`0 0 ${width} ${layout.height}`}
          role="img"
          aria-labelledby={titleId}
          className="block overflow-visible"
          onPointerLeave={() => setTip(null)}
        >
          <title id={titleId}>Fluxo do dinheiro neste mês</title>
          {layout.ribbons.map((ribbon, index) => (
            <path
              key={`${ribbon.sourceName}-${ribbon.targetName}-${index}`}
              d={ribbonPath(ribbon)}
              className={FILL[ribbon.role]}
              fillOpacity={ribbon.role === "room" ? 0.22 : 0.38}
              onPointerEnter={(event) => showTip(event, `${ribbon.sourceName} → ${ribbon.targetName}`, ribbon.value)}
              onPointerMove={(event) => showTip(event, `${ribbon.sourceName} → ${ribbon.targetName}`, ribbon.value)}
            />
          ))}
          {layout.boxes.map((node) => (
            <rect
              key={node.index}
              x={node.x}
              y={node.y}
              width={layout.nodeW}
              height={node.h}
              rx={3}
              className={FILL[node.role]}
              fillOpacity={node.role === "room" ? 0.55 : 1}
              onPointerEnter={(event) => showTip(event, node.name, node.value)}
              onPointerMove={(event) => showTip(event, node.name, node.value)}
            />
          ))}
          <text
            x={layout.hub.x + layout.nodeW / 2}
            y={layout.hubY}
            textAnchor="middle"
            className="fill-muted font-sans text-xs"
          >
            {layout.hub.name}
          </text>
          {[...layout.left, ...layout.right].map((label) => {
            const drifted = Math.abs(label.top + 15 - label.barMid) > 12;
            return (
              <g key={`${label.anchor}-${label.top}-${label.name}`}>
                {drifted ? (
                  <line
                    x1={label.barX}
                    y1={label.barMid}
                    x2={label.anchor === "end" ? label.x + 2 : label.x - 2}
                    y2={label.top + 15}
                    className="stroke-line"
                    strokeWidth={1}
                  />
                ) : null}
                <text x={label.x} y={label.top + 12} textAnchor={label.anchor} className="fill-ink font-sans text-xs">
                  {label.name}
                </text>
                <text
                  x={label.x}
                  y={label.top + 26}
                  textAnchor={label.anchor}
                  className={`font-sans text-xs tabular-nums ${MONEY[label.role]}`}
                >
                  {label.money}
                </text>
              </g>
            );
          })}
        </svg>
        {tip ? (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
            style={{
              left: Math.max(8, Math.min(tip.x + 12, width - 180)),
              top: Math.max(8, tip.y + 14),
            }}
          >
            <span>{tip.label}</span>
            <span className="ml-2 font-medium tabular-nums">{formatBRL(tip.value)}</span>
          </div>
        ) : null}
        </>
        ) : null}
      </div>
      {legend.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {legend.map((item) => (
            <li key={item.role} className="inline-flex items-center gap-2 text-sm text-muted">
              <span className={`size-2 shrink-0 rounded-full ${item.dot}`} />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      {note ? <figcaption className="mt-2 text-sm leading-6 text-muted">{note}</figcaption> : null}
    </figure>
  );
}
