import {meters} from "../src/lib/routing/astar.js";
const graph={
  version:"qa-graph-v1",
  nodes:{s:[106.8432,-6.1995],a:[106.8435,-6.1995],b:[106.844,-6.1995],c:[106.8445,-6.1995],t:[106.845,-6.1995],u:[106.8435,-6.1988],v:[106.8445,-6.1988]},
  edges:[
    {id:"entry",from:"s",to:"a"},{id:"bad",from:"a",to:"b"},{id:"short",from:"b",to:"c"},{id:"exit",from:"c",to:"t"},
    {id:"detour-1",from:"a",to:"u"},{id:"detour-2",from:"u",to:"v"},{id:"detour-3",from:"v",to:"c"}
  ].map(e=>({...e,bidirectional:true,name:e.id}))
};
// Assign exact geodesic distances once, outside production code.
export const routingGraph={...graph,edges:graph.edges.map(e=>({...e,distance_m:meters(graph.nodes[e.from],graph.nodes[e.to])}))};
export const from=[106.8433,-6.1995];
export const to=[106.8448,-6.1995];
