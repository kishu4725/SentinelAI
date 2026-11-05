// Detailed World Map Vector Paths & Major Country Label Coordinates (Equirectangular 1000x500 SVG Projection)

export const WORLD_CONTINENT_PATHS = [
  // North America - Canada & Alaska
  {
    id: 'na-north',
    name: 'Canada & Alaska',
    d: 'M 60,40 L 90,32 L 140,28 L 190,30 L 240,22 L 290,25 L 340,30 L 370,55 L 340,75 L 300,85 L 260,95 L 220,95 L 180,98 L 150,110 L 120,110 L 90,95 L 60,75 Z'
  },
  // North America - USA (Contiguous)
  {
    id: 'usa',
    name: 'United States',
    d: 'M 120,110 L 150,110 L 180,98 L 220,95 L 260,95 L 300,85 L 315,115 L 305,145 L 295,175 L 275,190 L 255,200 L 235,185 L 205,180 L 185,190 L 155,185 L 130,170 L 115,140 Z'
  },
  // North America - Mexico & Central America
  {
    id: 'mexico',
    name: 'Mexico',
    d: 'M 155,185 L 185,190 L 205,180 L 235,185 L 255,200 L 245,230 L 230,245 L 200,220 L 175,200 Z'
  },
  // Greenland
  {
    id: 'greenland',
    name: 'Greenland',
    d: 'M 340,20 L 410,18 L 430,35 L 415,70 L 380,75 L 350,55 Z'
  },
  // South America - Northern & Brazil
  {
    id: 'sa-brazil',
    name: 'Brazil & Amazon',
    d: 'M 255,250 L 305,240 L 350,265 L 375,305 L 360,355 L 320,385 L 285,355 L 270,305 Z'
  },
  // South America - Southern Cone (Argentina, Chile)
  {
    id: 'sa-south',
    name: 'Argentina & Chile',
    d: 'M 285,355 L 320,385 L 305,435 L 285,470 L 275,445 L 270,395 Z'
  },
  // Europe - Western (UK, France, Spain)
  {
    id: 'eu-west',
    name: 'Western Europe',
    d: 'M 460,85 L 485,82 L 495,100 L 480,125 L 465,145 L 450,140 L 440,115 Z'
  },
  // Europe - UK & Ireland
  {
    id: 'uk',
    name: 'United Kingdom',
    d: 'M 462,88 L 472,85 L 478,102 L 468,112 L 458,100 Z'
  },
  // Europe - Central & Eastern (Germany, Poland, Nordics)
  {
    id: 'eu-central',
    name: 'Central Europe',
    d: 'M 495,65 L 535,55 L 565,70 L 555,105 L 525,125 L 495,100 Z'
  },
  // Eurasia - Russia
  {
    id: 'russia',
    name: 'Russia',
    d: 'M 535,45 L 620,35 L 720,32 L 820,35 L 910,42 L 940,65 L 880,95 L 790,105 L 710,115 L 630,110 L 565,70 Z'
  },
  // Asia - Middle East
  {
    id: 'me',
    name: 'Middle East',
    d: 'M 555,130 L 610,125 L 635,160 L 620,195 L 575,190 L 550,155 Z'
  },
  // Africa - Northern & Sahara
  {
    id: 'af-north',
    name: 'North Africa',
    d: 'M 440,155 L 550,145 L 590,175 L 580,230 L 480,240 L 435,210 Z'
  },
  // Africa - Sub-Saharan & South Africa
  {
    id: 'af-south',
    name: 'Sub-Saharan Africa',
    d: 'M 480,240 L 580,230 L 615,280 L 590,360 L 545,395 L 500,360 L 475,300 Z'
  },
  // Asia - China & East Asia
  {
    id: 'china',
    name: 'China',
    d: 'M 670,125 L 760,115 L 820,135 L 830,185 L 785,210 L 715,200 L 665,165 Z'
  },
  // Asia - India Subcontinent
  {
    id: 'india',
    name: 'India',
    d: 'M 675,175 L 735,170 L 745,215 L 715,260 L 690,245 L 670,210 Z'
  },
  // Asia - Japan
  {
    id: 'japan',
    name: 'Japan',
    d: 'M 865,135 L 885,130 L 890,165 L 870,175 Z'
  },
  // Asia - Southeast Asia & Indonesia
  {
    id: 'se-asia',
    name: 'Southeast Asia',
    d: 'M 740,215 L 795,215 L 840,250 L 810,285 L 755,270 L 730,240 Z'
  },
  // Australia & New Zealand
  {
    id: 'australia',
    name: 'Australia',
    d: 'M 795,315 L 895,310 L 925,355 L 885,410 L 825,405 L 785,365 Z'
  }
];

export const MAJOR_COUNTRY_LABELS = [
  { name: 'CANADA', x: 210, y: 65 },
  { name: 'UNITED STATES', x: 200, y: 135 },
  { name: 'BRAZIL', x: 320, y: 310 },
  { name: 'UNITED KINGDOM', x: 440, y: 92 },
  { name: 'GERMANY', x: 512, y: 88 },
  { name: 'FRANCE', x: 472, y: 118 },
  { name: 'RUSSIA', x: 730, y: 65 },
  { name: 'CHINA', x: 750, y: 155 },
  { name: 'JAPAN', x: 885, y: 125 },
  { name: 'INDIA', x: 705, y: 200 },
  { name: 'AUSTRALIA', x: 850, y: 355 },
  { name: 'SOUTH AFRICA', x: 540, y: 375 }
];
