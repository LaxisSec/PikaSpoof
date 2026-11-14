/* PokéRadar: public-place explorer. No Pokémon GO game data is accessed. */
const map = L.map('map', { zoomControl: true }).setView([39.5, -98.35], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const statusEl = document.getElementById('status');
const listEl = document.getElementById('place-list');
const countEl = document.getElementById('result-count');
const mapLabel = document.getElementById('map-label');
const markers = L.layerGroup().addTo(map);
let places = [];
let activeFilter = 'all';
let selectedId = null;
let userMarker = null;
let searchMarker = null;
let searchTimer = null;

const icons = {
  park: L.divIcon({className:'',html:'<div style="width:13px;height:13px;background:#4dc98a;border:2px solid #eafff3;border-radius:50%;box-shadow:0 0 0 4px #4dc98a44"></div>',iconSize:[13,13],iconAnchor:[6,6]}),
  attraction: L.divIcon({className:'',html:'<div style="width:13px;height:13px;background:#ffad55;border:2px solid #fff1df;border-radius:50%;box-shadow:0 0 0 4px #ffad5544"></div>',iconSize:[13,13],iconAnchor:[6,6]}),
  square: L.divIcon({className:'',html:'<div style="width:13px;height:13px;background:#8b8bff;border:2px solid #f0efff;border-radius:50%;box-shadow:0 0 0 4px #8b8bff44"></div>',iconSize:[13,13],iconAnchor:[6,6]})
};

function classify(tags={}) {
  if (tags.leisure === 'park' || tags.leisure === 'garden' || tags.leisure === 'nature_reserve') return 'park';
  if (tags.place === 'square' || tags.highway === 'pedestrian' || tags.amenity === 'marketplace') return 'square';
  return 'attraction';
}
function typeName(type){ return type==='park'?'Park':type==='square'?'Plaza / pedestrian area':'Attraction'; }
function coords(lat,lon){ return `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`; }
function setStatus(text){statusEl.textContent=text;}
function safeText(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function renderPlaces(){
  markers.clearLayers();
  const visible=places.filter(p=>activeFilter==='all'||p.type===activeFilter);
  countEl.textContent=visible.length;
  if(!visible.length){
    listEl.innerHTML='<div class="empty-state"><span>⌖</span><strong>No mapped places found</strong><p>Try another area or select “All”.</p></div>';
  } else {
    listEl.innerHTML=visible.slice(0,100).map(p=>`
      <article class="place-card ${selectedId===p.id?'selected':''}" data-id="${p.id}">
        <strong>${safeText(p.name)}</strong>
        <small>${typeName(p.type)}</small>
        <span class="coords">${coords(p.lat,p.lon)}</span>
      </article>`).join('');
  }
  visible.forEach(p=>{
    const marker=L.marker([p.lat,p.lon],{icon:icons[p.type]||icons.attraction});
    marker.bindPopup(`<strong>${safeText(p.name)}</strong><br>${typeName(p.type)}<br><span class="popup-coords">${coords(p.lat,p.lon)}</span><br><button class="copy-coords" onclick="copyCoords(${p.lat},${p.lon})">COPY COORDINATES</button>`);
    marker.on('click',()=>{selectedId=p.id;renderPlaces();});
    marker.addTo(markers);
  });
}
window.copyCoords=(lat,lon)=>{
  const value=coords(lat,lon);
  if(navigator.clipboard?.writeText){navigator.clipboard.writeText(value).then(()=>setStatus(`Copied ${value}`)).catch(()=>setStatus(value));}
  else setStatus(value);
};

async function loadArea(){
  const b=map.getBounds();
  const south=b.getSouth(),west=b.getWest(),north=b.getNorth(),east=b.getEast();
  if(map.getZoom()<11){setStatus('Zoom in closer to discover mapped public places.');return;}
  setStatus('Loading public places for this map area…');
  const query=`[out:json][timeout:25];(node["leisure"~"park|garden|nature_reserve"](${south},${west},${north},${east});way["leisure"~"park|garden|nature_reserve"](${south},${west},${north},${east});relation["leisure"~"park|garden|nature_reserve"](${south},${west},${north},${east});node["place"="square"](${south},${west},${north},${east});way["place"="square"](${south},${west},${north},${east});node["tourism"~"attraction|museum|artwork|viewpoint"](${south},${west},${north},${east});way["tourism"~"attraction|museum|artwork|viewpoint"](${south},${west},${north},${east});node["amenity"~"marketplace|community_centre|library"](${south},${west},${north},${east}););out center tags;`;
  try{
    const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(query)});
    if(!response.ok) throw new Error('Map data service is temporarily unavailable.');
    const data=await response.json();
    const next=[];
    for(const el of data.elements||[]){
      const lat=el.lat??el.center?.lat,lon=el.lon??el.center?.lon;
      if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
      const tags=el.tags||{};
      const name=tags.name||tags['name:en']||tags.official_name||typeName(classify(tags));
      next.push({id:`osm-${el.type}-${el.id}`,lat,lon,name,type:classify(tags)});
    }
    places=next;
    renderPlaces();
    setStatus(`${places.length} mapped public places loaded · OpenStreetMap data`);
  }catch(err){setStatus(err.message+' Try refreshing in a moment.');}
}
map.on('moveend',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(loadArea,450);});
document.getElementById('refresh-btn').addEventListener('click',loadArea);

listEl.addEventListener('click',e=>{
  const card=e.target.closest('.place-card');if(!card)return;
  const p=places.find(x=>x.id===card.dataset.id);if(!p)return;
  selectedId=p.id;map.flyTo([p.lat,p.lon],Math.max(map.getZoom(),15),{duration:.6});
  renderPlaces();
});

document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.filter').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');activeFilter=btn.dataset.filter;renderPlaces();
}));

document.getElementById('search-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const q=document.getElementById('place-search').value.trim();if(!q)return;
  setStatus('Searching for location…');
  try{
    const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
    const res=await fetch(url,{headers:{'Accept-Language':'en'}});
    if(!res.ok)throw new Error('Location search is unavailable right now.');
    const results=await res.json();if(!results.length)throw new Error('No matching location found.');
    const r=results[0];map.flyTo([Number(r.lat),Number(r.lon)],13);
    mapLabel.textContent=(r.name||q).split(',')[0].toUpperCase();
    if(searchMarker)map.removeLayer(searchMarker);
    searchMarker=L.marker([Number(r.lat),Number(r.lon)]).addTo(map).bindPopup(`<strong>${safeText((r.name||q).split(',')[0])}</strong><br>Search location`).openPopup();
    setStatus(`Showing ${r.display_name}`);
  }catch(err){setStatus(err.message);}
});

document.getElementById('locate-btn').addEventListener('click',()=>{
  if(!navigator.geolocation){setStatus('Your browser does not support location access.');return;}
  setStatus('Requesting your location…');
  navigator.geolocation.getCurrentPosition(pos=>{
    const {latitude,longitude}=pos.coords;map.flyTo([latitude,longitude],15);
    if(userMarker)map.removeLayer(userMarker);
    userMarker=L.circleMarker([latitude,longitude],{radius:8,color:'#fff',weight:2,fillColor:'#ff334f',fillOpacity:1}).addTo(map).bindPopup(`<strong>Your location</strong><br><span class="popup-coords">${coords(latitude,longitude)}</span><br><button class="copy-coords" onclick="copyCoords(${latitude},${longitude})">COPY COORDINATES</button>`).openPopup();
    setStatus(`Your coordinates: ${coords(latitude,longitude)}`);
  },err=>setStatus(err.code===1?'Location permission was denied. You can still search for a city.':'Could not get your location. Try again.'),{enableHighAccuracy:true,timeout:10000});
});

const dialog=document.getElementById('spot-dialog');
document.getElementById('add-spot-btn').addEventListener('click',()=>{
  const c=map.getCenter();document.getElementById('spot-lat').value=c.lat.toFixed(6);document.getElementById('spot-lon').value=c.lng.toFixed(6);dialog.showModal();
});
document.getElementById('close-dialog').addEventListener('click',()=>dialog.close());
function getSaved(){try{return JSON.parse(localStorage.getItem('pokeradar-saved')||'[]')}catch{return[]}}
function setSaved(items){localStorage.setItem('pokeradar-saved',JSON.stringify(items));}
function renderSaved(){
  const el=document.getElementById('saved-list'),items=getSaved();
  if(!items.length){el.innerHTML='<p class="muted">No saved spots yet.</p>';return;}
  el.innerHTML=items.map((p,i)=>`<div class="saved-item"><span>${safeText(p.name)}<br><small class="muted">${coords(p.lat,p.lon)}</small></span><span><button data-go="${i}" title="Show on map">VIEW</button> <button data-delete="${i}" title="Delete">×</button></span></div>`).join('');
  items.forEach((p,i)=>{
    const m=L.marker([p.lat,p.lon],{icon:L.divIcon({className:'',html:'<div style="width:14px;height:14px;background:#ff3e5a;border:2px solid white;border-radius:50%"></div>',iconSize:[14,14],iconAnchor:[7,7]})}).bindPopup(`<strong>${safeText(p.name)}</strong><br><span class="popup-coords">${coords(p.lat,p.lon)}</span><br><button class="copy-coords" onclick="copyCoords(${p.lat},${p.lon})">COPY COORDINATES</button>`);
    m.addTo(savedMarkers);
  });
}
const savedMarkers=L.layerGroup().addTo(map);
document.getElementById('saved-list').addEventListener('click',e=>{
  const go=e.target.dataset.go,del=e.target.dataset.delete;
  if(go!==undefined){const p=getSaved()[Number(go)];if(p){map.flyTo([p.lat,p.lon],16);}}
  if(del!==undefined){const items=getSaved();items.splice(Number(del),1);setSaved(items);savedMarkers.clearLayers();renderSaved();}
});
document.getElementById('spot-form').addEventListener('submit',e=>{
  e.preventDefault();
  const name=document.getElementById('spot-name').value.trim(),lat=Number(document.getElementById('spot-lat').value),lon=Number(document.getElementById('spot-lon').value);
  if(!name||!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat>90||lon < -180||lon>180)return;
  const items=getSaved();items.push({name,lat,lon});setSaved(items);savedMarkers.clearLayers();renderSaved();dialog.close();e.target.reset();setStatus(`Saved ${name} on this device.`);
});
renderSaved();
