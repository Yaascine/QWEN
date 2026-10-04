import { GridModel } from './algorithms/grid';
import { dfs } from './algorithms/dfs';

const g = new GridModel(3, 3, { row: 0, col: 0 }, { row: 2, col: 2 });
g.setWall(g.idx({ row: 0, col: 1 }));
g.setWall(g.idx({ row: 1, col: 0 }));
g.setWall(g.idx({ row: 1, col: 2 }));
for (let i = 0; i < 9; i++) console.log(i, JSON.stringify(g.at(i)), 'kind', g.kind[i]);
console.log('---');
for (const e of dfs(g, { diagonal: false, cornerCutting: false })) console.log(e.type, JSON.stringify(e.node));
