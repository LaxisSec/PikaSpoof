const $ = id => document.getElementById(id);
const read = key => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
let listings = read("pokeradar_listings");
let trainers = read("pokeradar_trainers");

function escapeHTML(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderListings(){
 const q=$("pokemon-filter").value.toLowerCase(), type=$("listing-type").value;
 const filtered=listings.filter(x=>(type==="all"||x.type===type)&&[x.name,x.cp,x.iv,x.notes,x.owner].join(" ").toLowerCase().includes(q));
 $("pokemon-grid").innerHTML=filtered.map(x=>`<article class="pokemon-card"><div class="poke-image">${x.image?`<img src="${escapeHTML(x.image)}" alt="${escapeHTML(x.name)}" onerror="this.remove()">`:`<span class="poke-placeholder">⚡</span>`}</div><div><span class="card-type">${x.type==="offer"?"Offering":"Looking for"}</span><h3>${escapeHTML(x.name)}</h3><p>${x.cp?`<span class="cp">CP ${escapeHTML(x.cp)}</span> · `:""}${x.iv?escapeHTML(x.iv):"IV not listed"}</p><p>${escapeHTML(x.notes||"No extra details")}</p><p>Trainer: ${escapeHTML(x.owner||"Not provided")}</p><div class="card-actions"><button class="small-btn" data-copy="${escapeHTML(x.owner||"")}">Copy nickname</button><button class="small-btn" data-remove="${x.id}">Remove</button></div></div></article>`).join("");
 $("pokemon-empty").classList.toggle("hidden",filtered.length>0);
}
function renderTrainers(){
 $("trainer-grid").innerHTML=trainers.map(x=>`<article class="trainer-card"><h3>${escapeHTML(x.name)}</h3><div class="friend-code">${escapeHTML(x.code)}</div><p>${escapeHTML(x.note||"Pokémon GO Trainer")}</p><button class="small-btn" data-friend="${escapeHTML(x.code)}">Copy Friend Code</button> <button class="small-btn" data-trainer-remove="${x.id}">Remove</button></article>`).join("");
 $("trainer-empty").classList.toggle("hidden",trainers.length>0);
}
$("open-listing").onclick=()=>$("listing-dialog").showModal();
$("open-trainer").onclick=()=>$("trainer-dialog").showModal();
$("pokemon-filter").oninput=renderListings;
$("listing-type").onchange=renderListings;
$("listing-form").addEventListener("submit",e=>{
 if(e.submitter?.value==="cancel")return;
 e.preventDefault();
 const name=$("new-name").value.trim(); if(!name)return;
 listings.unshift({id:Date.now(),type:$("new-type").value,name,image:$("new-image").value.trim(),cp:$("new-cp").value,iv:$("new-iv").value.trim(),notes:$("new-notes").value.trim(),owner:$("new-owner").value.trim()});
 write("pokeradar_listings",listings);renderListings();$("listing-dialog").close();e.target.reset();
});
$("trainer-code").addEventListener("input",e=>{let n=e.target.value.replace(/\D/g,"").slice(0,12);e.target.value=n.replace(/(\d{4})(?=\d)/g,"$1 ").trim();});
$("trainer-form").addEventListener("submit",e=>{
 if(e.submitter?.value==="cancel")return;
 e.preventDefault();const code=$("trainer-code").value.replace(/\D/g,"");
 if(code.length!==12){alert("Enter all 12 digits of your Friend Code.");return;}
 trainers.unshift({id:Date.now(),name:$("trainer-name").value.trim(),code:code.replace(/(\d{4})(?=\d)/g,"$1 "),note:$("trainer-note").value.trim()});
 write("pokeradar_trainers",trainers);renderTrainers();$("trainer-dialog").close();e.target.reset();
});
document.addEventListener("click",e=>{
 const c=e.target.closest("[data-copy]");if(c){navigator.clipboard?.writeText(c.dataset.copy).then(()=>alert("Copied nickname."));}
 const f=e.target.closest("[data-friend]");if(f){navigator.clipboard?.writeText(f.dataset.friend).then(()=>alert("Friend Code copied."));}
 const r=e.target.closest("[data-remove]");if(r){listings=listings.filter(x=>x.id!==Number(r.dataset.remove));write("pokeradar_listings",listings);renderListings();}
 const tr=e.target.closest("[data-trainer-remove]");if(tr){trainers=trainers.filter(x=>x.id!==Number(tr.dataset.trainerRemove));write("pokeradar_trainers",trainers);renderTrainers();}
});
renderListings();renderTrainers();

// Map: public map places, not live Pokémon GO game data.
const map=L.map("map").setView([41.8781,-87.6298],11);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
const markers=L.layerGroup().addTo(map);
function setStatus(s){$("map-status").textContent=s;}
function markerColor(tags){if(tags.leisure==="park"||tags.landuse==="recreation_ground")return "#2b9b68";if(tags.amenity==="marketplace"||tags.place==="square")return "#e1a12a";return "#8c61d4";}
async function searchPlaces(lat,lon,zoom=13){
 markers.clearLayers();setStatus("Searching public map data…");
 const query=`[out:json][timeout:20];(node(around:4500,${lat},${lon})[leisure=park];way(around:4500,${lat},${lon})[leisure=park];node(around:4500,${lat},${lon})[place=square];node(around:4500,${lat},${lon})[tourism=attraction];);out center 35;`;
 try{
  const res=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",body:query});
  if(!res.ok)throw new Error("Map data service unavailable");
  const data=await res.json();
  data.elements.forEach(el=>{
   const lat=el.lat??el.center?.lat,lon=el.lon??el.center?.lon;if(!lat||!lon)return;
   const tags=el.tags||{},name=tags.name||"Public place";
   const color=markerColor(tags);
   L.circleMarker([lat,lon],{radius:7,color,fillColor:color,fillOpacity:.85,weight:2}).bindPopup(`<b>${escapeHTML(name)}</b><br><small>Public place suggestion — not verified game data</small>`).addTo(markers);
  });
  setStatus(`${data.elements.length} public place results. These are not confirmed PokéStops, Gyms, raids, or Pokémon spawns.`);
 }catch(err){setStatus("Could not load place data right now. Try again later.");}
}
async function geocode(q){
 setStatus("Finding location…");
 try{const r=await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q="+encodeURIComponent(q));const d=await r.json();if(!d.length)throw new Error();const lat=+d[0].lat,lon=+d[0].lon;map.setView([lat,lon],13);searchPlaces(lat,lon);}
 catch{setStatus("Location not found. Try a nearby city or landmark.");}
}
$("search-place").onclick=()=>{const q=$("place-search").value.trim();if(q)geocode(q);};
$("place-search").addEventListener("keydown",e=>{if(e.key==="Enter")$("search-place").click();});
$("use-location").onclick=()=>{if(!navigator.geolocation){setStatus("Location is not supported by this browser.");return;}setStatus("Requesting your location…");navigator.geolocation.getCurrentPosition(p=>{map.setView([p.coords.latitude,p.coords.longitude],14);searchPlaces(p.coords.latitude,p.coords.longitude);},()=>setStatus("Location permission was not granted."));};
searchPlaces(41.8781,-87.6298);
