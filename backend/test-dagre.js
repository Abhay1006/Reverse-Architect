import dagre from 'dagre';

const g = new dagre.graphlib.Graph({ compound: true });
g.setGraph({ rankdir: 'TB', ranksep: 50, nodesep: 50 });
g.setDefaultEdgeLabel(() => ({}));

g.setNode('group1', { label: 'group1' });
g.setNode('child1', { width: 100, height: 100 });
g.setNode('child2', { width: 100, height: 100 });
g.setParent('child1', 'group1');
g.setParent('child2', 'group1');

dagre.layout(g);

console.log('Group1:', g.node('group1'));
console.log('Child1:', g.node('child1'));
console.log('Child2:', g.node('child2'));
