import { ImportWorkspace } from "@/components/ImportWorkspace";
import { UniversalSourceImport } from "@/components/UniversalSourceImport";

export default function ImportsPage(){
  return <>
    <div className="page" style={{paddingBottom:0}}><UniversalSourceImport/></div>
    <ImportWorkspace/>
  </>;
}
