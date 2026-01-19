export class AirlineService {
  constructor() {
    // Sample airline database
    this.airlines = [
      { code: 'AA', name: 'American Airlines' },
      { code: 'DL', name: 'Delta Air Lines' },
      { code: 'UA', name: 'United Airlines' },
      { code: 'WN', name: 'Southwest Airlines' },
      { code: 'B6', name: 'JetBlue Airways' },
      { code: 'AS', name: 'Alaska Airlines' },
      { code: 'NK', name: 'Spirit Airlines' },
      { code: 'F9', name: 'Frontier Airlines' },
      { code: 'G4', name: 'Allegiant Air' },
      { code: 'SY', name: 'Sun Country Airlines' },
      { code: 'BA', name: 'British Airways' },
      { code: 'AF', name: 'Air France' },
      { code: 'LH', name: 'Lufthansa' },
      { code: 'KL', name: 'KLM Royal Dutch Airlines' },
      { code: 'AC', name: 'Air Canada' },
      { code: 'AM', name: 'Aeromexico' },
      { code: 'VS', name: 'Virgin Atlantic' },
      { code: 'LX', name: 'Swiss International Air Lines' },
      { code: 'OS', name: 'Austrian Airlines' },
      { code: 'SN', name: 'Brussels Airlines' }
    ];

    // Sample flight data (simulated API response)
    this.flightDatabase = {
      'AA100': {
        airline: 'AA',
        flightNumber: '100',
        origin: 'JFK - John F. Kennedy International Airport',
        destination: 'LAX - Los Angeles International Airport',
        scheduledArrival: '2024-01-15 14:30',
        estimatedArrival: '2024-01-15 14:25',
        terminal: 'Terminal 4',
        gate: 'Gate 42',
        status: 'on-time'
      },
      'DL456': {
        airline: 'DL',
        flightNumber: '456',
        origin: 'ATL - Hartsfield-Jackson Atlanta International Airport',
        destination: 'LAX - Los Angeles International Airport',
        scheduledArrival: '2024-01-15 16:45',
        estimatedArrival: '2024-01-15 17:10',
        terminal: 'Terminal 5',
        gate: 'Gate 52',
        status: 'delayed'
      },
      'UA789': {
        airline: 'UA',
        flightNumber: '789',
        origin: 'ORD - O\'Hare International Airport',
        destination: 'LAX - Los Angeles International Airport',
        scheduledArrival: '2024-01-15 18:20',
        estimatedArrival: '2024-01-15 18:20',
        terminal: 'Terminal 7',
        gate: 'Gate 71',
        status: 'on-time'
      },
      'WN234': {
        airline: 'WN',
        flightNumber: '234',
        origin: 'DEN - Denver International Airport',
        destination: 'LAX - Los Angeles International Airport',
        scheduledArrival: '2024-01-15 15:15',
        estimatedArrival: '2024-01-15 15:15',
        terminal: 'Terminal 1',
        gate: 'Gate 12',
        status: 'on-time'
      },
      'B6567': {
        airline: 'B6',
        flightNumber: '567',
        origin: 'BOS - Boston Logan International Airport',
        destination: 'LAX - Los Angeles International Airport',
        scheduledArrival: '2024-01-15 19:40',
        estimatedArrival: '2024-01-15 19:40',
        terminal: 'Terminal 5',
        gate: 'Gate 53',
        status: 'on-time'
      }
    };
  }

  searchAirlines(query) {
    if (!query || query.length < 1) return [];
    
    const searchTerm = query.toLowerCase();
    return this.airlines.filter(airline => 
      airline.code.toLowerCase().includes(searchTerm) ||
      airline.name.toLowerCase().includes(searchTerm)
    ).slice(0, 10);
  }

  getAirlineByCode(code) {
    return this.airlines.find(airline => 
      airline.code.toUpperCase() === code.toUpperCase()
    );
  }

  async searchFlights(airlineCode, flightNumber) {
    // Simulate API call delay
    await this.delay(500);

    const flightKey = `${airlineCode.toUpperCase()}${flightNumber}`;
    
    if (this.flightDatabase[flightKey]) {
      return this.flightDatabase[flightKey];
    }

    // Generate mock flight data for demo purposes
    return this.generateMockFlightData(airlineCode, flightNumber);
  }

  generateMockFlightData(airlineCode, flightNumber) {
    const origins = [
      'JFK - John F. Kennedy International Airport',
      'ORD - O\'Hare International Airport',
      'DFW - Dallas/Fort Worth International Airport',
      'ATL - Hartsfield-Jackson Atlanta International Airport',
      'DEN - Denver International Airport',
      'SFO - San Francisco International Airport',
      'LAS - Las Vegas McCarran International Airport',
      'MIA - Miami International Airport',
      'BOS - Boston Logan International Airport'
    ];

    const statuses = ['on-time', 'on-time', 'on-time', 'delayed', 'on-time'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    const scheduledTime = new Date();
    scheduledTime.setHours(scheduledTime.getHours() + Math.floor(Math.random() * 6) + 1);
    
    const estimatedTime = new Date(scheduledTime);
    if (status === 'delayed') {
      estimatedTime.setMinutes(estimatedTime.getMinutes() + Math.floor(Math.random() * 45) + 15);
    }

    const terminal = Math.floor(Math.random() * 8) + 1;
    const gate = Math.floor(Math.random() * 80) + 1;

    return {
      airline: airlineCode.toUpperCase(),
      flightNumber: flightNumber,
      origin: origins[Math.floor(Math.random() * origins.length)],
      destination: 'LAX - Los Angeles International Airport',
      scheduledArrival: this.formatDateTime(scheduledTime),
      estimatedArrival: this.formatDateTime(estimatedTime),
      terminal: `Terminal ${terminal}`,
      gate: `Gate ${gate}`,
      status: status
    };
  }

  formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Real-time flight status update (simulated)
  async getFlightStatus(airlineCode, flightNumber) {
    await this.delay(300);
    
    const flightKey = `${airlineCode.toUpperCase()}${flightNumber}`;
    const flight = this.flightDatabase[flightKey] || this.generateMockFlightData(airlineCode, flightNumber);
    
    return {
      status: flight.status,
      estimatedArrival: flight.estimatedArrival,
      terminal: flight.terminal,
      gate: flight.gate
    };
  }
}
