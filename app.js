const LEON_CENTER = [21.125, -101.686];
const ZOOM_LEVEL = 12;

const map = L.map('map', {
  zoomControl: false
}).setView(LEON_CENTER, ZOOM_LEVEL);

L.control.zoom({ position: 'bottomright' }).addTo(map);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri',
  maxZoom: 19
}).addTo(map);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19
}).addTo(map);

// =========================================================================
// COLORES POR CATEGORÍA / DEPENDENCIA
// =========================================================================
const CATEGORY_COLORS = [
  { keywords: ['presidencia', 'mi barrio habla', 'atención ciudadana', 'ayuntamiento'], color: '#E63946' },
  { keywords: ['juventud', 'imju'], color: '#F77F00' },
  { keywords: ['seguridad', 'policía', 'juzgado', '911', 'prevención', 'cepol', 'vial'], color: '#1D3557' },
  { keywords: ['comunitario', 'plaza de la ciudadanía', 'desarrollo social', 'comedor'], color: '#2A9D8F' },
  { keywords: ['biblioteca', 'educación', 'saber', 'museo', 'cultura', 'teatro', 'forum'], color: '#457B9D' },
  { keywords: ['delegación', 'participativo', 'rural'], color: '#8338EC' },
  { keywords: ['imuvi', 'urbano', 'vivienda', 'obra pública', 'sapal', 'implan', 'fidoc'], color: '#3A86FF' },
  { keywords: ['protección civil', 'bomberos', 'salud', 'hospital', 'caises'], color: '#D62828' },
  { keywords: ['mujer', 'immujeres', 'dif', 'papnna', 'infancia', 'familia'], color: '#FF006E' }
];

function getCategoryColor(category, name, description) {
  const text = `${category} ${name} ${description}`.toLowerCase();
  for (const item of CATEGORY_COLORS) {
    if (item.keywords.some(kw => text.includes(kw))) {
      return item.color;
    }
  }
  return '#0077B6';
}

// =========================================================================
// ESTADO GLOBAL Y REFERENCIAS DEL DOM
// =========================================================================
let pointsOfInterest = [];
let activeMarkers = [];
let searchTerm = '';

const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const mobileBackdrop = document.getElementById('mobile-backdrop');
const globalSearchInput = document.getElementById('global-search');
const layerSearchInput = document.getElementById('layer-search');
const clearSearchBtn = document.getElementById('clear-search-btn');
const poiListEl = document.getElementById('poi-list');
const infoDrawer = document.getElementById('info-drawer');
const drawerContent = document.getElementById('drawer-content');
const closeDrawerBtn = document.getElementById('close-drawer');

// =========================================================================
// CONTROL DE BARRA LATERAL (COMPUTADORA Y TELÉFONO)
// =========================================================================
function isMobileView() {
  return window.innerWidth <= 768;
}

function toggleSidebar() {
  if (isMobileView()) {
    const isOpen = document.body.classList.toggle('sidebar-open-mobile');
    if (mobileBackdrop) {
      mobileBackdrop.classList.toggle('active', isOpen);
    }
  } else {
    document.body.classList.toggle('sidebar-collapsed');
  }
}

function closeSidebar() {
  if (isMobileView()) {
    document.body.classList.remove('sidebar-open-mobile');
    if (mobileBackdrop) mobileBackdrop.classList.remove('active');
  } else {
    document.body.classList.add('sidebar-collapsed');
  }
}

if (toggleSidebarBtn) {
  toggleSidebarBtn.addEventListener('click', toggleSidebar);
}

if (closeSidebarBtn) {
  closeSidebarBtn.addEventListener('click', closeSidebar);
}

if (mobileBackdrop) {
  mobileBackdrop.addEventListener('click', closeSidebar);
}

window.addEventListener('resize', () => {
  if (!isMobileView()) {
    document.body.classList.remove('sidebar-open-mobile');
    if (mobileBackdrop) mobileBackdrop.classList.remove('active');
  }
});

// =========================================================================
// CARGA DE LOS 110 DESTINOS DESDE KML
// =========================================================================
async function cargarDestinosDesdeKML() {
  try {
    const response = await fetch('./destinos_leon.kml');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const kmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');

    const placemarks = Array.from(xmlDoc.getElementsByTagName('Placemark'));
    const cargados = [];

    placemarks.forEach((pm, index) => {
      const nameNode = pm.getElementsByTagName('name')[0];
      const descNode = pm.getElementsByTagName('description')[0];
      const coordNode = pm.getElementsByTagName('coordinates')[0];

      if (!coordNode) return;

      const rawCoords = coordNode.textContent.trim().split(',');
      const lng = parseFloat(rawCoords[0]);
      const lat = parseFloat(rawCoords[1]);
      if (isNaN(lat) || isNaN(lng)) return;

      let folderName = 'Servicios Municipales';
      if (pm.parentNode && pm.parentNode.nodeName === 'Folder') {
        const folderNameNode = pm.parentNode.getElementsByTagName('name')[0];
        if (folderNameNode && folderNameNode.textContent.trim()) {
          folderName = folderNameNode.textContent.trim();
        }
      }

      const name = nameNode ? nameNode.textContent.trim() : `Sede Municipal #${index + 1}`;
      const description = descNode ? descNode.textContent.trim() : 'Trámites y servicios disponibles en sede.';
      const color = getCategoryColor(folderName, name, description);

      cargados.push({
        id: index + 1,
        name,
        category: folderName,
        lat,
        lng,
        description,
        color
      });
    });

    pointsOfInterest = cargados;
  } catch (error) {
    console.error('Error al cargar destinos_leon.kml:', error);
  }
}

// =========================================================================
// MARCADORES Y LISTA LATERAL
// =========================================================================
function renderMarkers(places) {
  activeMarkers.forEach(item => map.removeLayer(item.marker));
  activeMarkers = [];

  places.forEach(place => {
    const customIcon = L.divIcon({
      className: 'custom-poi-marker',
      html: `<div style="
        background-color: ${place.color};
        width: 15px;
        height: 15px;
        border-radius: 50%;
        border: 2.5px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
        cursor: pointer;
      "></div>`,
      iconSize: [15, 15],
      iconAnchor: [7.5, 7.5]
    });

    const marker = L.marker([place.lat, place.lng], { icon: customIcon });

    marker.on('click', () => {
      map.flyTo([place.lat, place.lng], 16, { duration: 0.8 });
      showPlaceDetails(place);
    });

    marker.addTo(map);
    activeMarkers.push({ data: place, marker });
  });
}

function renderSidebarList(places) {
  if (!poiListEl) return;

  poiListEl.innerHTML = places
    .map(
      place => `
      <div class="poi-item" data-id="${place.id}">
        <div class="poi-info">
          <span style="width:10px; height:10px; border-radius:50%; background:${place.color}; display:inline-block; flex-shrink:0;"></span>
          <span title="${place.name}">${place.name}</span>
        </div>
        <small style="color:#9ca3af; font-size:11px; margin-left:8px; flex-shrink:0;">${place.category}</small>
      </div>`
    )
    .join('');

  poiListEl.querySelectorAll('.poi-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = Number(item.dataset.id);
      const place = pointsOfInterest.find(p => p.id === id);
      if (place) {
        if (isMobileView()) closeSidebar();
        map.flyTo([place.lat, place.lng], 16, { duration: 0.8 });
        showPlaceDetails(place);
      }
    });
  });
}

// =========================================================================
// BÚSQUEDA SINCRONIZADA (BARRA SUPERIOR Y FILTRO LATERAL)
// =========================================================================
function handleSearch(value, source) {
  searchTerm = value;

  if (source !== 'global' && globalSearchInput) globalSearchInput.value = value;
  if (source !== 'layer' && layerSearchInput) layerSearchInput.value = value;

  if (clearSearchBtn) {
    clearSearchBtn.classList.toggle('hidden', value.trim() === '');
  }

  const query = searchTerm.toLowerCase().trim();
  const filtered = pointsOfInterest.filter(
    p =>
      !query ||
      p.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
  );

  renderMarkers(filtered);
  renderSidebarList(filtered);
}

if (globalSearchInput) {
  globalSearchInput.addEventListener('input', e => handleSearch(e.target.value, 'global'));
}

if (layerSearchInput) {
  layerSearchInput.addEventListener('input', e => handleSearch(e.target.value, 'layer'));
}

if (clearSearchBtn) {
  clearSearchBtn.addEventListener('click', () => {
    handleSearch('', 'clear');
  });
}

// =========================================================================
// PANEL DE INFORMACIÓN (#info-drawer)
// =========================================================================
function showPlaceDetails(place) {
  if (!infoDrawer || !drawerContent) return;

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;

  drawerContent.innerHTML = `
    <span class="drawer-category" style="background:${place.color};">${place.category}</span>
    <h2 class="drawer-title">${place.name}</h2>
    <div class="drawer-section">
      <h4>Información y trámites</h4>
      <p>${place.description}</p>
    </div>
    <div class="drawer-section">
      <h4>Coordenadas</h4>
      <p>${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}</p>
    </div>
    <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
       style="display:block; text-align:center; background:#2563eb; color:#fff; padding:11px; border-radius:10px; text-decoration:none; font-weight:600; margin-top:16px;">
      Cómo llegar (Google Maps)
    </a>
  `;

  infoDrawer.classList.add('active');
}

if (closeDrawerBtn && infoDrawer) {
  closeDrawerBtn.addEventListener('click', () => {
    infoDrawer.classList.remove('active');
  });
}

// =========================================================================
// INICIALIZACIÓN
// =========================================================================
(async function initApp() {
  await cargarDestinosDesdeKML();
  renderMarkers(pointsOfInterest);
  renderSidebarList(pointsOfInterest);
})();