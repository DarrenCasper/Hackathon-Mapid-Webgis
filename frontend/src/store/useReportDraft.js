import { create } from "zustand";
const emptyDraft = () => ({type:"",description:"",point:null,pointStationId:null,confirmed:false,photo:null,requestId:crypto.randomUUID(),routeContext:null,routeFeedback:null,routeEdgeId:null});
// In-memory and project-local: navigation preserves the draft, closing the tab does not.
export const useReportDraft = create(set => ({
  ...emptyDraft(),
  update: partial => set(partial),
  clear: () => set(emptyDraft()),
}));
