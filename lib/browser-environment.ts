export function isLocalDevelopmentHostname(hostname:string){
  const normalized=hostname.replace(/^\[|\]$/g,"").toLowerCase();
  if(normalized==="localhost"||normalized==="127.0.0.1"||normalized==="::1"||normalized.endsWith(".localhost")||normalized.endsWith(".local"))return true;
  const match=normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if(!match)return false;
  const octets=match.slice(1).map(Number);
  if(octets.some(value=>value>255))return false;
  return octets[0]===10||octets[0]===127||(octets[0]===172&&octets[1]>=16&&octets[1]<=31)||(octets[0]===192&&octets[1]===168)||(octets[0]===169&&octets[1]===254);
}
