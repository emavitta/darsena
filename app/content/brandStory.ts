// Historical sources are linked beside the relevant passage in the app.
export const brandStory = [
  {
    id: 'harbor',
    number: '01',
    title: 'The Darsena and the waterways that built a city',
    paragraphs: [
      'Milan has a harbor, even though it is far from the sea. The Darsena took shape in 1603 on the site of the older lake of Sant’Eustorgio. The Naviglio Grande and, later, the Naviglio Pavese connected this basin to a wider network: boats arrived, goods were unloaded, and materials passed into the hands of the people building the city.',
      'That network also carried the marble of the Duomo. Blocks of pink Candoglia marble travelled from the quarries along the Toce, Lake Maggiore, the Ticino and the Naviglio Grande, reaching Sant’Eustorgio. The Conca di Viarenna connected this waterway to the inner canal ring, allowing boats to continue to the little harbor of Santo Stefano, close to the cathedral’s building site.',
      'This is the idea behind the app’s name: a working harbor. Separate worktrees can gather in one place, with their tools, tasks and activity in view. The blue basin and its two waterways give that idea a shape, rooted in a real part of Milan.',
    ],
    sources: [
      {
        label: 'Museo di Sant’Eustorgio · The Darsena',
        url: 'https://www.museosanteustorgio.it/storia-darsena/',
      },
      {
        label: 'Veneranda Fabbrica · Candoglia marble',
        url: 'https://www.duomomilano.it/scopri-chi-siamo/la-cava-di-candoglia/',
      },
      {
        label: 'Diocesi di Milano · The route to the Duomo',
        url: 'https://www.chiesadimilano.it/news/arte-cultura/arte-cultura-arte-anno-2009/il-marmo-arriva-solo-da-candoglia-34267.html',
      },
    ],
  },
  {
    id: 'gate',
    number: '02',
    title: 'Porta Ticinese, a threshold to Milan',
    paragraphs: [
      'At the end of the basin stands Porta Ticinese, the neoclassical gate designed by Luigi Cagnola and built between 1801 and 1814. It marks one of the city’s historic entrances, where the harbor meets Piazza XXIV Maggio.',
      'In the icon, the gate is seen from above as a simple gray rectangle, darker than the surrounding buildings. Beside the curves of the water, it gives the map a recognizable point of arrival.',
    ],
    sources: [
      {
        label: 'Ministero della Cultura · Luigi Cagnola',
        url: 'https://siusa-archivi.cultura.gov.it/cgi-bin/siusa/pagina.pl?Chiave=19466&TipoPag=prodpersona',
      },
    ],
  },
  {
    id: 'oak',
    number: '03',
    title: 'The oak, a living place of remembrance',
    paragraphs: [
      'The red oak of Piazza XXIV Maggio was planted in 1924 by the Capè family to remember the fallen of the First World War. In the years that followed, veterans returned beneath its branches to commemorate their companions.',
      'Set back from the water, its broad canopy is part of the square’s memory. We included it as a small tribute to remembrance and endurance: a living presence beside the city’s stone and water.',
    ],
    sources: [
      {
        label: 'Comune di Milano · The monumental oak',
        url: 'https://www.comune.milano.it/argomenti/ambiente-e-animali/gli-alberi-monumentali-a-milano/la-quercia-di-piazza-xxiv-maggio',
      },
    ],
  },
  {
    id: 'tram',
    number: '04',
    title: 'The tram, Milan in motion',
    paragraphs: [
      'The tiny rectangle recalls the historic “Ventotto”, ATM’s series 1500 trams. The first prototype appeared in 1927; after a second in 1928, another 500 were built in 1929–1930. Their two bogies let a long carriage find its way through the city’s narrow streets.',
      'Generations of passengers and careful maintenance made these trams part of Milan’s everyday identity. In our map, a small yellow-orange rectangle recalls their familiar color and suggests that everyday movement through the square.',
    ],
    sources: [
      {
        label: 'ATM & Museo della Scienza · The Ventotto (PDF)',
        url: 'https://www.museoscienza.org/besrv/sites/default/files/2024-01/DOSSIER_TramMilano1928_al%20Museo_25gen24.pdf',
      },
    ],
  },
] as const
