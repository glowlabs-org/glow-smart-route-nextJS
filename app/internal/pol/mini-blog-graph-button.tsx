"use client";

import React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export type MiniBlogGraphCluster =
  | "core"
  | "liquidity"
  | "governance"
  | "solar"
  | "network";

type MiniBlogGraphEntry = {
  title: string;
  paragraphs: string[];
  learnMore?: string[];
};

export type MiniBlogGraphButtonProps = {
  currentBlogId: string;
  onSelectBlog: (id: string) => void;
  miniBlogs: Record<string, MiniBlogGraphEntry>;
  miniBlogClusters: Record<string, MiniBlogGraphCluster>;
};

const GRAPH_CLUSTER_COLORS: Record<
  MiniBlogGraphCluster,
  { fill: string; bg: string; ring: string; text: string }
> = {
  core: {
    fill: "var(--color-glow-orange)",
    bg: "rgba(255,180,114,0.14)",
    ring: "rgba(255,180,114,0.35)",
    text: "#b87a3a",
  },
  liquidity: {
    fill: "var(--color-glow-purple)",
    bg: "rgba(220,196,255,0.18)",
    ring: "rgba(220,196,255,0.45)",
    text: "#8b6bb5",
  },
  governance: {
    fill: "var(--color-glow-green)",
    bg: "rgba(204,255,212,0.22)",
    ring: "rgba(204,255,212,0.5)",
    text: "#4a9e5c",
  },
  solar: {
    fill: "var(--color-glow-yellow)",
    bg: "rgba(247,252,196,0.28)",
    ring: "rgba(247,252,196,0.55)",
    text: "#8a8530",
  },
  network: {
    fill: "#b8b8b8",
    bg: "rgba(184,184,184,0.1)",
    ring: "rgba(184,184,184,0.25)",
    text: "#888888",
  },
};

const GRAPH_CLUSTER_LABELS: Record<MiniBlogGraphCluster, string> = {
  core: "Protocol Core",
  liquidity: "Liquidity",
  governance: "Governance",
  solar: "Solar & Impact",
  network: "Network",
};

type GraphEdge = { from: string; to: string };
type GraphNode = { id: string; label: string; cluster: MiniBlogGraphCluster };

function buildGraphEdgeKey(from: string, to: string) {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

function createSeededRandom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function computeKnowledgeGraphLayout({
  nodeIds,
  edges,
  clusters,
  width,
  height,
}: {
  nodeIds: string[];
  edges: GraphEdge[];
  clusters: Record<string, MiniBlogGraphCluster>;
  width: number;
  height: number;
}) {
  const random = createSeededRandom(7);
  const centerX = width / 2;
  const centerY = height / 2;

  const clusterSeeds: Record<MiniBlogGraphCluster, { ax: number; ay: number }> = {
    core: { ax: -0.5, ay: -0.34 },
    liquidity: { ax: 0.5, ay: -0.32 },
    governance: { ax: -0.52, ay: 0.44 },
    solar: { ax: 0.46, ay: 0.44 },
    network: { ax: 0.02, ay: -0.62 },
  };

  const nodes: Record<string, { x: number; y: number; vx: number; vy: number }> =
    {};

  for (const id of nodeIds) {
    const cluster = clusters[id] ?? "core";
    const seed = clusterSeeds[cluster];
    nodes[id] = {
      x: centerX + seed.ax * width * 0.46 + (random() - 0.5) * 164,
      y: centerY + seed.ay * height * 0.46 + (random() - 0.5) * 136,
      vx: 0,
      vy: 0,
    };
  }

  for (let i = 0; i < 620; i += 1) {
    const alpha = Math.pow(1 - i / 620, 1.5);
    const force = alpha * 0.4;

    for (let a = 0; a < nodeIds.length; a += 1) {
      for (let b = a + 1; b < nodeIds.length; b += 1) {
        const nodeA = nodes[nodeIds[a]];
        const nodeB = nodes[nodeIds[b]];
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;

        if (distance < 132) {
          const repulsion = ((132 - distance) / distance) * force * 1.65;
          nodeA.vx -= dx * repulsion;
          nodeA.vy -= dy * repulsion;
          nodeB.vx += dx * repulsion;
          nodeB.vy += dy * repulsion;
        }
      }
    }

    for (const edge of edges) {
      const nodeA = nodes[edge.from];
      const nodeB = nodes[edge.to];
      const dx = nodeB.x - nodeA.x;
      const dy = nodeB.y - nodeA.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;
      const spring = ((distance - 172) / distance) * force * 0.12;
      nodeA.vx += dx * spring;
      nodeA.vy += dy * spring;
      nodeB.vx -= dx * spring;
      nodeB.vy -= dy * spring;
    }

    const clusterCenters: Record<MiniBlogGraphCluster, { x: number; y: number }> = {
      core: { x: 0, y: 0 },
      liquidity: { x: 0, y: 0 },
      governance: { x: 0, y: 0 },
      solar: { x: 0, y: 0 },
      network: { x: 0, y: 0 },
    };
    const clusterCount: Record<MiniBlogGraphCluster, number> = {
      core: 0,
      liquidity: 0,
      governance: 0,
      solar: 0,
      network: 0,
    };

    for (const id of nodeIds) {
      const cluster = clusters[id] ?? "core";
      clusterCenters[cluster].x += nodes[id].x;
      clusterCenters[cluster].y += nodes[id].y;
      clusterCount[cluster] += 1;
    }

    for (const cluster of Object.keys(clusterCenters) as MiniBlogGraphCluster[]) {
      const count = clusterCount[cluster] || 1;
      clusterCenters[cluster].x /= count;
      clusterCenters[cluster].y /= count;
    }

    for (const id of nodeIds) {
      const cluster = clusters[id] ?? "core";
      nodes[id].vx += (clusterCenters[cluster].x - nodes[id].x) * force * 0.006;
      nodes[id].vy += (clusterCenters[cluster].y - nodes[id].y) * force * 0.006;
      nodes[id].vx += (centerX - nodes[id].x) * force * 0.0038;
      nodes[id].vy += (centerY - nodes[id].y) * force * 0.0038;
    }

    for (const id of nodeIds) {
      nodes[id].vx *= 0.5;
      nodes[id].vy *= 0.5;
      nodes[id].x += nodes[id].vx;
      nodes[id].y += nodes[id].vy;
      nodes[id].x = Math.max(42, Math.min(width - 42, nodes[id].x));
      nodes[id].y = Math.max(36, Math.min(height - 36, nodes[id].y));
    }
  }

  return nodes;
}

function curvedEdgePath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  index: number
) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const bend = Math.min(distance * 0.12, 20) * (index % 2 === 0 ? 1 : -1);
  const midX = (fromX + toX) / 2 + (-dy / distance) * bend;
  const midY = (fromY + toY) / 2 + (dx / distance) * bend;
  return `M${fromX},${fromY} Q${midX},${midY} ${toX},${toY}`;
}

function MiniBlogGraphReadingPanel({
  blogId,
  miniBlogs,
  miniBlogClusters,
  onNavigate,
  onBack,
  onClose,
  onSelectBlog,
  canGoBack,
}: {
  blogId: string;
  miniBlogs: Record<string, MiniBlogGraphEntry>;
  miniBlogClusters: Record<string, MiniBlogGraphCluster>;
  onNavigate: (id: string) => void;
  onBack: () => void;
  onClose: () => void;
  onSelectBlog: (id: string) => void;
  canGoBack: boolean;
}) {
  const blog = miniBlogs[blogId];
  if (!blog) return null;

  const cluster = miniBlogClusters[blogId] ?? "core";
  const colors = GRAPH_CLUSTER_COLORS[cluster];
  const relatedTopics = blog.learnMore ?? [];

  return (
    <aside className="min-h-[320px] shrink-0 md:h-full md:w-[420px] border-t md:border-t-0 md:border-l border-border/20 bg-card flex flex-col overflow-y-auto">
      <div className="px-5 py-4 border-b border-border/20 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {canGoBack ? (
              <button
                type="button"
                aria-label="Back"
                className="h-7 w-7 rounded-lg border border-border/20 text-xs text-muted-foreground hover:text-foreground hover:border-border/40 transition-colors"
                onClick={onBack}
              >
                &#8592;
              </button>
            ) : null}
            <span
              className="inline-flex rounded-md px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest"
              style={{ color: colors.text, backgroundColor: colors.bg }}
            >
              {GRAPH_CLUSTER_LABELS[cluster]}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close details"
            className="h-7 w-7 rounded-lg border border-border/20 text-xs text-muted-foreground hover:text-foreground hover:border-border/40 transition-colors"
            onClick={onClose}
          >
            &#10005;
          </button>
        </div>
        <h3 className="text-base font-semibold tracking-tight leading-snug">
          {blog.title}
        </h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-5 space-y-4">
          {blog.paragraphs.map((paragraph, index) => (
            <p
              key={`${blogId}-graph-body-${index}`}
              className="text-sm leading-relaxed text-muted-foreground"
            >
              {paragraph}
            </p>
          ))}

          {relatedTopics.length > 0 ? (
            <div className="pt-3 border-t border-border/20 space-y-2.5">
              <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                Related Topics
              </div>
              <div className="space-y-2">
                {relatedTopics
                  .filter((relatedId) => miniBlogs[relatedId])
                  .map((relatedId) => {
                    const relatedCluster = miniBlogClusters[relatedId] ?? "core";
                    return (
                      <button
                        key={`${blogId}-graph-related-${relatedId}`}
                        type="button"
                        className="w-full rounded-xl border border-border/20 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                        onClick={() => onNavigate(relatedId)}
                      >
                        <span className="inline-flex items-center gap-2 text-xs text-foreground/90">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{
                              backgroundColor:
                                GRAPH_CLUSTER_COLORS[relatedCluster].fill,
                            }}
                          />
                          {miniBlogs[relatedId].title}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="pt-3 border-t border-border/20">
              <a
                href="https://glow.org/blog"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                Read full blog
                <span aria-hidden>&#8599;</span>
              </a>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-5 border-t border-border/20">
        <Button
          type="button"
          className="w-full rounded-xl"
          onClick={() => onSelectBlog(blogId)}
        >
          Open Topic In Modal
        </Button>
      </div>
    </aside>
  );
}

function MiniBlogGraph({
  miniBlogs,
  miniBlogClusters,
  onSelectBlog,
  currentBlogId,
}: {
  miniBlogs: Record<string, MiniBlogGraphEntry>;
  miniBlogClusters: Record<string, MiniBlogGraphCluster>;
  onSelectBlog: (id: string) => void;
  currentBlogId?: string;
}) {
  const graphWidth = 760;
  const graphHeight = 560;

  const graphNodeIds = React.useMemo(() => Object.keys(miniBlogs), [miniBlogs]);
  const graphNodes = React.useMemo(
    () =>
      graphNodeIds.map((id) => ({
        id,
        label: miniBlogs[id].title,
        cluster: miniBlogClusters[id] ?? "core",
      })) satisfies GraphNode[],
    [graphNodeIds, miniBlogs, miniBlogClusters]
  );
  const graphEdges = React.useMemo(() => {
    const deduped = new Set<string>();
    const edges: GraphEdge[] = [];

    for (const fromId of graphNodeIds) {
      const learnMore = miniBlogs[fromId].learnMore ?? [];
      for (const toId of learnMore) {
        if (!miniBlogs[toId]) continue;
        const key = buildGraphEdgeKey(fromId, toId);
        if (deduped.has(key)) continue;
        deduped.add(key);
        edges.push({ from: fromId, to: toId });
      }
    }
    return edges;
  }, [graphNodeIds, miniBlogs]);
  const graphConnectionCount = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const id of graphNodeIds) counts[id] = 0;
    for (const edge of graphEdges) {
      counts[edge.from] += 1;
      counts[edge.to] += 1;
    }
    return counts;
  }, [graphNodeIds, graphEdges]);

  const positions = React.useMemo(
    () =>
      computeKnowledgeGraphLayout({
        nodeIds: graphNodeIds,
        edges: graphEdges,
        clusters: miniBlogClusters,
        width: graphWidth,
        height: graphHeight,
      }),
    [graphNodeIds, graphEdges, miniBlogClusters]
  );

  const [selected, setSelected] = React.useState<string | null>(
    currentBlogId ?? null
  );
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<string[]>(
    currentBlogId ? [currentBlogId] : []
  );

  React.useEffect(() => {
    if (!currentBlogId) return;
    setSelected(currentBlogId);
    setHistory([currentBlogId]);
  }, [currentBlogId]);

  const handleSelect = React.useCallback((id: string) => {
    setSelected(id);
    setHistory((prev) =>
      prev.length > 0 && prev[prev.length - 1] === id ? prev : [...prev, id]
    );
  }, []);

  const handleBack = React.useCallback(() => {
    setHistory((prev) => {
      if (prev.length <= 1) return prev;
      const nextHistory = prev.slice(0, -1);
      setSelected(nextHistory[nextHistory.length - 1] ?? null);
      return nextHistory;
    });
  }, []);

  const handleClosePanel = React.useCallback(() => {
    setSelected(null);
    setHistory(currentBlogId ? [currentBlogId] : []);
  }, [currentBlogId]);

  const activeNode = hovered ?? selected;
  const shouldDimUnrelated = hovered !== null;

  const { connectedNodes, activeEdgeKeys } = React.useMemo(() => {
    if (!activeNode) {
      return {
        connectedNodes: new Set<string>(),
        activeEdgeKeys: new Set<string>(),
      };
    }

    const relatedNodes = new Set<string>([activeNode]);
    const relatedEdges = new Set<string>();

    for (const edge of graphEdges) {
      if (edge.from === activeNode || edge.to === activeNode) {
        relatedNodes.add(edge.from);
        relatedNodes.add(edge.to);
        relatedEdges.add(buildGraphEdgeKey(edge.from, edge.to));
      }
    }

    return { connectedNodes: relatedNodes, activeEdgeKeys: relatedEdges };
  }, [activeNode, graphEdges]);

  return (
    <div className="h-full rounded-3xl border border-border/20 bg-card overflow-hidden">
      <div className="h-full min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        <div className="flex-1 min-w-0 min-h-0 md:min-h-full flex flex-col shrink-0">
          <div className="px-5 py-4 border-b border-border/20 flex items-start justify-between gap-5">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold tracking-tight">
                Glow Protocol Topics
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                {graphNodes.length} topics · {graphEdges.length} connections
              </div>
            </div>
            <div className="hidden lg:flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
              {(Object.keys(GRAPH_CLUSTER_LABELS) as MiniBlogGraphCluster[]).map(
                (cluster) => (
                  <div key={cluster} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: GRAPH_CLUSTER_COLORS[cluster].fill,
                      }}
                    />
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                      {GRAPH_CLUSTER_LABELS[cluster]}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="relative flex-1 min-h-0 overflow-auto">
            <svg
              viewBox={`0 0 ${graphWidth} ${graphHeight}`}
              className="h-[760px] w-full min-w-[760px]"
              role="img"
              aria-label="Mini-blog knowledge graph"
            >
              {graphEdges.map((edge, index) => {
                const from = positions[edge.from];
                const to = positions[edge.to];
                if (!from || !to) return null;

                const edgeKey = buildGraphEdgeKey(edge.from, edge.to);
                const isActive = activeEdgeKeys.has(edgeKey);
                const isDimmed = Boolean(shouldDimUnrelated && !isActive);

                return (
                  <path
                    key={edgeKey}
                    d={curvedEdgePath(from.x, from.y, to.x, to.y, index)}
                    fill="none"
                    className="stroke-foreground transition-all duration-300"
                    strokeWidth={isActive ? 1.3 : 0.75}
                    strokeOpacity={isDimmed ? 0.06 : isActive ? 0.32 : 0.16}
                  />
                );
              })}

              {graphNodes.map((node) => {
                const point = positions[node.id];
                if (!point) return null;

                const clusterColors = GRAPH_CLUSTER_COLORS[node.cluster];
                const baseRadius = 7 + Math.min(graphConnectionCount[node.id], 5) * 1.4;
                const isSelected = selected === node.id;
                const isHovered = hovered === node.id;
                const isConnected = connectedNodes.has(node.id);
                const isActive = isSelected || isHovered;
                const isCurrent = currentBlogId === node.id;
                const isDimmed = Boolean(
                  shouldDimUnrelated && !isActive && !isConnected
                );

                return (
                  <g
                    key={node.id}
                    className="cursor-pointer"
                    onClick={() => handleSelect(node.id)}
                    onMouseEnter={() => setHovered(node.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={baseRadius + 12}
                      fill="transparent"
                    />

                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={isActive || isCurrent ? baseRadius + 7 : baseRadius + 4}
                      fill={isActive || isCurrent ? clusterColors.bg : "transparent"}
                      stroke={isActive || isCurrent ? clusterColors.ring : "transparent"}
                      strokeWidth={1}
                      className="transition-all duration-200"
                    />

                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={baseRadius}
                      fill={isCurrent ? "var(--color-glow-orange)" : clusterColors.fill}
                      stroke={clusterColors.ring}
                      strokeWidth={isActive || isCurrent ? 1.5 : 0.7}
                      opacity={isDimmed ? 0.22 : isActive || isCurrent ? 1 : 0.56}
                      className="transition-all duration-200"
                    />

                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={isActive || isCurrent ? 2.6 : 2}
                      fill={isActive || isCurrent ? "#ffffff" : clusterColors.fill}
                      opacity={isDimmed ? 0.2 : isActive || isCurrent ? 0.95 : 0.72}
                      className="transition-all duration-200"
                    />

                    <text
                      x={point.x}
                      y={point.y + baseRadius + 14}
                      textAnchor="middle"
                      fill="currentColor"
                      className="text-[8px] font-mono uppercase tracking-wider select-none pointer-events-none text-foreground transition-opacity duration-300"
                      opacity={isDimmed ? 0.24 : isActive || isCurrent ? 0.86 : 0.58}
                    >
                      {node.label.length > 26 ? `${node.label.slice(0, 24)}...` : node.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {!selected && !hovered ? (
              <div className="absolute bottom-4 inset-x-0 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground/40 pointer-events-none">
                Click a topic to explore
              </div>
            ) : null}
          </div>
        </div>

        {selected ? (
          <MiniBlogGraphReadingPanel
            blogId={selected}
            miniBlogs={miniBlogs}
            miniBlogClusters={miniBlogClusters}
            onNavigate={handleSelect}
            onBack={handleBack}
            onClose={handleClosePanel}
            onSelectBlog={onSelectBlog}
            canGoBack={history.length > 1}
          />
        ) : null}
      </div>
    </div>
  );
}

export function MiniBlogGraphButton({
  currentBlogId,
  onSelectBlog,
  miniBlogs,
  miniBlogClusters,
}: MiniBlogGraphButtonProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        className="w-full rounded-xl border border-border/40 bg-muted/30 hover:bg-foreground hover:text-background dark:bg-primary dark:text-primary-foreground dark:border-primary dark:hover:bg-primary/90 px-4 py-3 text-xs font-mono uppercase tracking-wider text-foreground/70 transition-colors"
        onClick={() => setOpen(true)}
      >
        View all topics
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[1540px] sm:max-w-[1540px] w-[99vw] h-[88vh] max-h-[920px] flex flex-col p-0 gap-0 overflow-hidden bg-card border border-border/20">
          <DialogHeader className="p-5 pb-0">
            <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
              Knowledge Graph
            </DialogTitle>
            <DialogDescription className="sr-only">
              Visual map of all mini-blog topics and their connections.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 p-5 pt-3">
            <MiniBlogGraph
              currentBlogId={currentBlogId}
              miniBlogs={miniBlogs}
              miniBlogClusters={miniBlogClusters}
              onSelectBlog={(id) => {
                setOpen(false);
                onSelectBlog(id);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
