import Modal from './Modal';

/** Educational content: uninformed vs informed search, weighted pathfinding. */
export default function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About Search Algorithms" onClose={onClose} wide>
      <div className="space-y-5 text1">
        <section>
          <h3 className="section-title mb-1">The search problem</h3>
          <p>
            Pathfinding asks: given a graph of nodes and edges (here: grid cells and moves), find a sequence of
            steps from START to TARGET. Algorithms differ in <b className="text0">which node they expand next</b>.
            That single decision produces the dramatically different exploration patterns you can watch in the Lab.
          </p>
        </section>

        <section>
          <h3 className="section-title mb-2">Uninformed vs informed search</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <div className="font-bold text0 mb-1">Uninformed (blind)</div>
              <p className="mb-2">No knowledge of where the goal lies — the frontier order comes only from the structure itself.</p>
              <ul className="space-y-1 ml-4 list-disc">
                <li><b className="text0">BFS</b> — expands the shallowest node first (queue). Wave-like; shortest edge-count on unweighted graphs.</li>
                <li><b className="text0">DFS</b> — expands the deepest node first (stack). Dives into one branch; no optimality guarantee.</li>
                <li><b className="text0">Dijkstra</b> — expands the cheapest-known-distance node (priority queue). Optimal for non-negative weights, but still blind: it spreads toward the goal from all sides.</li>
              </ul>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <div className="font-bold text0 mb-1">Informed (heuristic-guided)</div>
              <p className="mb-2">Uses h(n) — an estimate of remaining cost to the goal — to bias expansion in a useful direction.</p>
              <ul className="space-y-1 ml-4 list-disc">
                <li><b className="text0">A*</b> — priority f(n) = g(n) + h(n). Balances cost so far against estimated remaining cost. Optimal when h is admissible & consistent.</li>
                <li><b className="text0">GBFS</b> — priority h(n) only. Very fast and direct, but ignores accumulated cost → paths are often sub-optimal.</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h3 className="section-title mb-1">How a heuristic changes the picture</h3>
          <pre className="mono text-[11px] panel p-3 overflow-x-auto">{`
   UNINFORMED (Dijkstra)             INFORMED (A*, Manhattan h)

   ██████▓▓▓▓▓▓▓▓▓▓                    ····░░░░░░░░░░░░░░
   ███ S ▓▓▓▓▓▓▓▓▓▓   ▓ = expanded     ····░░░S░░░░░░░░░░   ░ = expanded
   ███▓▓▓▓▓▓▓▓▓▓▓▓▓                    ····░░░░░░░░░▒▒▒▒▒▒
   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ T                    ··········░░░░░░░T

   expands in all directions           stretches toward the goal
`}</pre>
          <p>
            With a perfect heuristic A* expands only along the optimal path; with h(n)=0 A* degenerates into
            Dijkstra. Real heuristics sit between these extremes — that trade-off is exactly what Compare mode shows.
          </p>
        </section>

        <section>
          <h3 className="section-title mb-1">Weighted graphs</h3>
          <p>
            Terrain costs (forest ×2, sand ×5, water ×10) make “fewest steps” and “cheapest route” different questions.
            BFS/DFS answer the first, Dijkstra/A*/GBFS honor the second. Try the <b className="text0">Weighted Shortcut</b>{' '}
            preset: BFS takes the short-but-expensive road while Dijkstra happily walks further through cheap terrain.
          </p>
        </section>

        <section>
          <h3 className="section-title mb-1">Complexity cheat-sheet</h3>
          <table className="w-full mono text-[11px]">
            <thead>
              <tr className="text2 text-left border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="py-1 font-normal">Algorithm</th><th className="font-normal">Time</th><th className="font-normal">Space</th><th className="font-normal">Optimal?</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}><td>BFS</td><td>O(V+E)</td><td>O(V)</td><td>edges, unweighted</td></tr>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}><td>DFS</td><td>O(V+E)</td><td>O(V)</td><td>no guarantee</td></tr>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}><td>Dijkstra</td><td>O((V+E) log V)*</td><td>O(V)</td><td>yes (non-neg. weights)</td></tr>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}><td>A*</td><td>depends on h — worst O(b^d)</td><td>O(V)</td><td>if h admissible+consistent</td></tr>
              <tr><td>GBFS</td><td>worst O(b^d)</td><td>O(V)</td><td>no</td></tr>
            </tbody>
          </table>
          <p className="text-[10px] text2 mt-1">* with a binary heap. b = branching factor, d = solution depth.</p>
        </section>
      </div>
    </Modal>
  );
}
