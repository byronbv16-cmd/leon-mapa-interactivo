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
// CONFIGURACIÓN DE COLORES POR CATEGORÍA / DEPENDENCIA
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
// ESTADO GLOBAL Y CARGA AUTOMÁTICA DE LOS 110 DESTINOS DESDE KML
// =========================================================================
let pointsOfInterest = [];
let activeMarkers = [];
let selectedCategory = 'ALL';
let searchTerm = '';

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

      // KML almacena coordenadas como: longitud,latitud,altitud
      const rawCoords = coordNode.textContent.trim().split(',');
      const lng = parseFloat(rawCoords[0]);
      const lat = parseFloat(rawCoords[1]);
      if (isNaN(lat) || isNaN(lng)) return;

      // Extraer carpeta padre de Google Earth como categoría
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
        address: 'León, Guanajuato',
        description,
        color
      });
    });

    pointsOfInterest = cargados;
    console.log(`✅ Cargados ${pointsOfInterest.length} destinos desde destinos_leon.kml`);
  } catch (error) {
    console.error('Error al cargar destinos_leon.kml:', error);
  }
}

// =========================================================================
// RENDERIZADO DE MARCADORES LIMPIOS EN EL MAPA
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
        transition: transform 0.15s ease;
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

  updateCounter(places.length);
}

// =========================================================================
// FILTRADO, BÚSQUEDA Y CONTROLES DE INTERFAZ
// =========================================================================
function applyFilters() {
  const query = searchTerm.toLowerCase().trim();

  const filtered = pointsOfInterest.filter(p => {
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesQuery =
      !query ||
      p.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  renderMarkers(filtered);
  renderSidebarList(filtered);
}

function populateCategoryFilters() {
  const filterContainer =
    document.getElementById('category-filters') ||
    document.getElementById('categoryFilter') ||
    document.querySelector('.category-filters');

  if (!filterContainer) return;

  const categories = ['ALL', ...new Set(pointsOfInterest.map(p => p.category))];

  if (filterContainer.tagName === 'SELECT') {
    filterContainer.innerHTML = categories
      .map(cat => `<option value="${cat}">${cat === 'ALL' ? `Todas las categorías (${pointsOfInterest.length})` : cat}</option>`)
      .join('');
    filterContainer.addEventListener('change', e => {
      selectedCategory = e.target.value;
      applyFilters();
    });
  } else {
    filterContainer.innerHTML = categories
      .map(
        cat => `
        <button class="filter-btn ${cat === 'ALL' ? 'active' : ''}" data-category="${cat}">
          ${cat === 'ALL' ? `Todos (${pointsOfInterest.length})` : cat}
        </button>`
      )
      .join('');

    filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCategory = btn.dataset.category;
        applyFilters();
      });
    });
  }
}

function setupSearchInput() {
  const searchInput =
    document.getElementById('search-input') ||
    document.getElementById('searchInput') ||
    document.querySelector('input[type="search"], input[type="text"]');

  if (!searchInput) return;

  searchInput.addEventListener('input', e => {
    searchTerm = e.target.value;
    applyFilters();
  });
}

function updateCounter(count) {
  const counterEl =
    document.getElementById('results-count') ||
    document.getElementById('total-counter') ||
    document.getElementById('counter');

  if (counterEl) {
    counterEl.textContent = `${count} de ${pointsOfInterest.length} destinos`;
  }
}

function renderSidebarList(places) {
  const listEl =
    document.getElementById('places-list') ||
    document.getElementById('results-list') ||
    document.getElementById('poi-list');

  if (!listEl) return;

  listEl.innerHTML = places
    .map(
      place => `
      <div class="poi-item" data-id="${place.id}" style="cursor:pointer; padding:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="width:10px; height:10px; border-radius:50%; background:${place.color}; display:inline-block; flex-shrink:0;"></span>
          <strong>${place.name}</strong>
        </div>
        <small style="opacity:0.75; display:block; margin-left:18px;">${place.category}</small>
      </div>`
    )
    .join('');

  listEl.querySelectorAll('.poi-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = Number(item.dataset.id);
      const place = pointsOfInterest.find(p => p.id === id);
      if (place) {
        map.flyTo([place.lat, place.lng], 16, { duration: 0.8 });
        showPlaceDetails(place);
      }
    });
  });
}

// =========================================================================
// FICHA INFORMATIVA BAJO DEMANDA AL SELECCIONAR UN DESTINO
// =========================================================================
function showPlaceDetails(place) {
  const panel =
    document.getElementById('detail-panel') ||
    document.getElementById('info-panel') ||
    document.getElementById('sidebar-detail');

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;

  const detailHTML = `
    <div style="padding: 16px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <span style="background:${place.color}; color:#fff; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:600;">
          ${place.category}
        </span>
        <button onclick="this.closest('#detail-panel, #info-panel, #sidebar-detail')?.classList.add('hidden')" 
                style="background:none; border:none; color:inherit; font-size:18px; cursor:pointer;">&times;</button>
      </div>
      <h3 style="margin: 10px 0 8px 0; font-size: 1.15rem;">${place.name}</h3>
      <div style="font-size: 0.9rem; line-height: 1.5; margin-bottom: 14px; max-height: 260px; overflow-y: auto;">
        ${place.description}
      </div>
      <div style="font-size: 0.8rem; opacity: 0.8; margin-bottom: 14px;">
        Coordenadas: ${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}
      </div>
      <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
         style="display:block; text-align:center; background:#2563eb; color:#fff; padding:10px; border-radius:8px; text-decoration:none; font-weight:600;">
        Cómo llegar (Google Maps)
      </a>
    </div>
  `;

  if (panel) {
    panel.classList.remove('hidden');
    panel.innerHTML = detailHTML;
  } else {
    L.popup({ maxWidth: 320 })
      .setLatLng([place.lat, place.lng])
      .setContent(detailHTML)
      .openOn(map);
  }
}

// =========================================================================
// INICIALIZACIÓN PRINCIPAL
// =========================================================================
(async function initApp() {
  await cargarDestinosDesdeKML();
  populateCategoryFilters();
  setupSearchInput();
  renderMarkers(pointsOfInterest);
  renderSidebarList(pointsOfInterest);
})();