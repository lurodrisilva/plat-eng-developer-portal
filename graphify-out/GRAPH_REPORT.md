# Graph Report - plat-eng-developer-portal  (2026-07-15)

## Corpus Check
- 20 files · ~5,870 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 157 nodes · 199 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `af2537ff`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 15 edges
2. `Screen` - 14 edges
3. `context_window` - 7 edges
4. `Tunables` - 7 edges
5. `cn()` - 7 edges
6. `scripts` - 6 edges
7. `cost` - 6 edges
8. `workspace` - 5 edges
9. `current_usage` - 5 edges
10. `xp.dev — Developer Portal` - 5 edges

## Surprising Connections (you probably didn't know these)
- `AppDetailsProps` --references--> `Screen`  [EXTRACTED]
  src/components/AppDetails.tsx → src/types.ts
- `DashboardProps` --references--> `Screen`  [EXTRACTED]
  src/components/Dashboard.tsx → src/types.ts
- `NewProjectInitProps` --references--> `Screen`  [EXTRACTED]
  src/components/NewProjectInit.tsx → src/types.ts
- `SidebarProps` --references--> `Screen`  [EXTRACTED]
  src/components/Sidebar.tsx → src/types.ts
- `ConfigureAppProps` --references--> `Screen`  [EXTRACTED]
  src/components/ConfigureApp.tsx → src/types.ts

## Import Cycles
- None detected.

## Communities (13 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (24): AppDetails(), AppDetailsProps, performanceData, ConfigureApp(), ConfigureAppProps, ConfirmAssembly(), ConfirmAssemblyProps, Dashboard() (+16 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (23): cost, total_api_duration_ms, total_cost_usd, total_duration_ms, total_lines_added, total_lines_removed, cwd, effort (+15 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+8 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (14): dependencies, clsx, dotenv, express, @google/genai, lucide-react, motion, react (+6 more)

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (19): description, devDependencies, autoprefixer, tailwindcss, tsx, @types/express, @types/node, typescript (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (11): context_window, context_window_size, current_usage, remaining_percentage, total_input_tokens, total_output_tokens, used_percentage, cache_creation_input_tokens (+3 more)

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (8): host, name, owner, workspace, added_dirs, current_dir, project_dir, repo

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (7): resets_at, used_percentage, rate_limits, five_hour, seven_day, resets_at, used_percentage

### Community 9 - "Community 9"
Cohesion: 0.33
Nodes (5): Run locally, Secrets, Stack, Status, xp.dev — Developer Portal

### Community 11 - "Community 11"
Cohesion: 0.40
Nodes (4): backgroundTasks, sessionId, sessionStartTimestamp, timestamp

### Community 12 - "Community 12"
Cohesion: 0.50
Nodes (3): description, name, requestFramePermissions

## Knowledge Gaps
- **95 isolated node(s):** `name`, `description`, `requestFramePermissions`, `name`, `private` (+90 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `context_window` connect `Community 5` to `Community 1`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 3` to `Community 4`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `workspace` connect `Community 7` to `Community 1`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `name`, `description`, `requestFramePermissions` to the rest of the system?**
  _95 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13063063063063063 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._