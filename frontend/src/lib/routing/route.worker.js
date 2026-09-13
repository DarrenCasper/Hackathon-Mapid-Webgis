import {findRoute} from "./astar.js";
self.onmessage=({data})=>{
  try { self.postMessage({result:findRoute(data.graph,data.from,data.to,data.blocked,data.recommended)}); }
  catch(error){self.postMessage({error:error.message});}
};
