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

const pointsOfInterest = [
  { id: 1, name: 'Centro Comunitario (Lomas de la Presa)', category: 'Centro Comunitario', lat: 21.1712, lng: -101.6705, address: 'Lomas de la Presa, León, Gto.', phone: '477 123 4567' },
  { id: 2, name: 'Centro Comunitario (Canteritas de Echeveste)', category: 'Centro Comunitario', lat: 21.1668, lng: -101.6680, address: 'Canteritas de Echeveste, León, Gto.', phone: '477 234 5678' },
  { id: 3, name: 'Centro Comunitario (El Valladito)', category: 'Centro Comunitario', lat: 21.1640, lng: -101.6620, address: 'El Valladito, León, Gto.', phone: '477 345 6789' },
  { id: 4, name: 'Centro Comunitario (La Ermita)', category: 'Centro Comunitario', lat: 21.1490, lng: -101.7100, address: 'La Ermita, León, Gto.', phone: '477 456 7890' },
  { id: 5, name: 'Centro Comunitario (Saucillo de las Joyas)', category: 'Centro Comunitario', lat: 21.1405, lng: -101.7280, address: 'Las Joyas, León, Gto.', phone: '477 567 8901' },
  { id: 6, name: 'Biblioteca Pública Municipal (Efraín Huerta)', category: 'Educación y Cultura', lat: 21.1370, lng: -101.7150, address: 'Las Joyas, León, Gto.', phone: '477 678 9012' },
  { id: 7, name: 'Biblioteca Pública Municipal (Juan Rulfo)', category: 'Educación y Cultura', lat: 21.1290, lng: -101.6920, address: 'León, Gto.', phone: '477 789 0123' },
  { id: 8, name: 'Desarrollo Integral de la Familia (DIF)', category: 'Atención Social', lat: 21.1250, lng: -101.6550, address: 'Blvd. Juan Alonso de Torres, León, Gto.', phone: '477 890 1234' },
  { id: 9, name: 'Centro Comunitario (Granjeno)', category: 'Centro Comunitario', lat: 21.1030, lng: -101.6620, address: 'El Granjeno, León, Gto.', phone: '477 901 2345' },
  { id: 10, name: 'Centro Comunitario (Valle de San José)', category: 'Centro Comunitario', lat: 21.0920, lng: -101.6500, address: 'Valle de San José, León, Gto.', phone: '477 012 3456' }
];

const markersMap = new Map();
const poiListContainer = document.getElementById('poi-list');
const infoDrawer = document.getElementById('info-drawer');
const drawerContent = document.getElementById('drawer-content');
const backdrop = document.getElementById('mobile-backdrop');
const globalSearchInput = document.getElementById('global-search');
const clearSearchBtn = document.getElementById('clear-search-btn');

const isMobile = () => window.innerWidth <= 768;

// Control de apertura/cierre del menú lateral
function toggleSidebar(forceState) {
  if (isMobile()) {
    const shouldOpen = forceState !== undefined ? forceState : !document.body.classList.contains('sidebar-open-mobile');
    document.body.classList.toggle('sidebar-open-mobile', shouldOpen);
    backdrop.classList.toggle('active', shouldOpen);
  } else {
    const shouldCollapse = forceState !== undefined ? !forceState : !document.body.classList.contains('sidebar-collapsed');
    document.body.classList.toggle('sidebar-collapsed', shouldCollapse);
  }
  setTimeout(() => map.invalidateSize(), 310);
}

document.getElementById('toggle-sidebar-btn').addEventListener('click', () => toggleSidebar());
document.getElementById('close-sidebar-btn').addEventListener('click', () => toggleSidebar(false));
backdrop.addEventListener('click', () => {
  toggleSidebar(false);
  infoDrawer.classList.remove('active');
});

function initPOIs() {
  poiListContainer.innerHTML = '';
  
  pointsOfInterest.forEach(poi => {
    const marker = L.marker([poi.lat, poi.lng]).addTo(map);
    marker.on('click', () => {
      map.flyTo([poi.lat, poi.lng], 15);
      openDrawer(poi);
    });
    markersMap.set(poi.id, { marker, visible: true, data: poi });

    const poiDiv = document.createElement('div');
    poiDiv.className = 'poi-item';
    poiDiv.dataset.id = poi.id;
    poiDiv.innerHTML = `
      <div class="poi-info">
        <i class="fa-solid fa-location-dot"></i>
        <span>${poi.name}</span>
      </div>
      <i class="fa-regular fa-eye toggle-eye" title="Mostrar/Ocultar"></i>
    `;

    poiDiv.querySelector('.poi-info').addEventListener('click', () => {
      if (isMobile()) toggleSidebar(false);
      map.flyTo([poi.lat, poi.lng], 15);
      openDrawer(poi);
    });

    const eyeIcon = poiDiv.querySelector('.toggle-eye');
    eyeIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePoiVisibility(poi.id, eyeIcon);
    });

    poiListContainer.appendChild(poiDiv);
  });
}

function togglePoiVisibility(id, eyeIcon) {
  const item = markersMap.get(id);
  if (!item) return;

  if (item.visible) {
    map.removeLayer(item.marker);
    item.visible = false;
    eyeIcon.classList.replace('fa-eye', 'fa-eye-slash');
    eyeIcon.style.opacity = '0.4';
  } else {
    item.marker.addTo(map);
    item.visible = true;
    eyeIcon.classList.replace('fa-eye-slash', 'fa-eye');
    eyeIcon.style.opacity = '1';
  }
}

function openDrawer(poi) {
  drawerContent.innerHTML = `
    <h2 class="drawer-title">${poi.name}</h2>
    <span class="drawer-category">${poi.category}</span>
    
    <div class="drawer-section">
      <h4>Dirección</h4>
      <p>${poi.address}</p>
    </div>
    
    <div class="drawer-section">
      <h4>Teléfono de Atención</h4>
      <p><a href="tel:${poi.phone.replace(/\s+/g, '')}" style="color:#60a5fa; text-decoration:none;">${poi.phone}</a></p>
    </div>

    <div class="drawer-section">
      <h4>Trámites Disponibles</h4>
      <p>Consultas comunitarias, talleres recreativos, solicitudes de apoyo social y trámites municipales.</p>
    </div>
  `;
  infoDrawer.classList.add('active');
}

document.getElementById('close-drawer').addEventListener('click', () => {
  infoDrawer.classList.remove('active');
});

// Filtro en lista lateral
document.getElementById('layer-search').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  document.querySelectorAll('.poi-item').forEach(item => {
    const text = item.querySelector('span').innerText.toLowerCase();
    item.style.display = text.includes(query) ? 'flex' : 'none';
  });
});

// Buscador general superior + botón de limpiar
globalSearchInput.addEventListener('input', (e) => {
  clearSearchBtn.classList.toggle('hidden', e.target.value.length === 0);
});

clearSearchBtn.addEventListener('click', () => {
  globalSearchInput.value = '';
  clearSearchBtn.classList.add('hidden');
  globalSearchInput.focus();
});

globalSearchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const query = e.target.value.toLowerCase().trim();
    if (!query) return;
    const match = pointsOfInterest.find(p => p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query));
    if (match) {
      if (isMobile()) toggleSidebar(false);
      globalSearchInput.blur();
      map.flyTo([match.lat, match.lng], 16);
      openDrawer(match);
    } else {
      alert('Lugar no encontrado dentro del catálogo actual.');
    }
  }
});

initPOIs();