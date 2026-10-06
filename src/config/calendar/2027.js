const rows = [
    [1, 'bahrain', 'Formula 1 Gulf Air Bahrain Grand Prix 2027', 'Bahrain', 'Sakhir', 'Bahrain', '2027-03-12|2027-03-14', true],
    [2, 'saudi-arabia', 'Formula 1 STC Saudi Arabian Grand Prix 2027', 'Saudi Arabia', 'Jeddah', 'Saudi Arabia', '2027-03-19|2027-03-21', false],
    [3, 'australia', 'Formula 1 Moet & Chandon Australian Grand Prix 2027', 'Australia', 'Melbourne', 'Australia', '2027-04-02|2027-04-04', true],
    [4, 'japan', 'Formula 1 Lenovo Japanese Grand Prix 2027', 'Japan', 'Suzuka', 'Japan', '2027-04-09|2027-04-11', true],
    [5, 'china', 'Formula 1 Heineken Chinese Grand Prix 2027', 'China', 'Shanghai', 'China', '2027-04-16|2027-04-18', false],
    [6, 'miami', 'Formula 1 Hard Rock Miami Grand Prix 2027', 'Miami', 'Miami', 'United States', '2027-04-30|2027-05-02', false],
    [7, 'canada', 'Formula 1 AWS Grand Prix du Canada 2027', 'Canada', 'Montreal', 'Canada', '2027-05-21|2027-05-23', true],
    [8, 'monaco', 'Formula 1 Louis Vuitton Grand Prix de Monaco 2027', 'Monaco', 'Monte Carlo', 'Monaco', '2027-06-04|2027-06-06', true],
    [9, 'portugal', 'Formula 1 MSC Cruises Grande Premio de Portugal 2027', 'Portugal', 'Portugal', 'Portugal', '2027-06-18|2027-06-20', false],
    [10, 'great-britain', 'Formula 1 TAG Heuer British Grand Prix 2027', 'Great Britain', 'Silverstone', 'Great Britain', '2027-07-02|2027-07-04', true],
    [11, 'austria', 'Formula 1 Qatar Airways Austrian Grand Prix 2027', 'Austria', 'Spielberg', 'Austria', '2027-07-09|2027-07-11', false],
    [12, 'belgium', 'Formula 1 MSC Cruises Belgian Grand Prix 2027', 'Belgium', 'Spa', 'Belgium', '2027-07-23|2027-07-25', false],
    [13, 'hungary', 'Formula 1 Aramco Hungarian Grand Prix 2027', 'Hungary', 'Budapest', 'Hungary', '2027-07-30|2027-08-01', false],
    [14, 'italy', "Formula 1 Pirelli Gran Premio d'Italia 2027", 'Italy', 'Monza', 'Italy', '2027-09-03|2027-09-05', true],
    [15, 'spain', 'Formula 1 Lenovo Gran Premio de Espana 2027', 'Spain', 'Spain', 'Spain', '2027-09-10|2027-09-12', false],
    [16, 'azerbaijan', 'Formula 1 Qatar Airways Azerbaijan Grand Prix 2027', 'Azerbaijan', 'Baku', 'Azerbaijan', '2027-09-24|2027-09-26', false],
    [17, 'turkiye', 'Formula 1 MSC Cruises Turkish Grand Prix 2027', 'Turkiye', 'Turkiye', 'Turkiye', '2027-10-01|2027-10-03', false],
    [18, 'singapore', 'Formula 1 Singapore Airlines Singapore Grand Prix 2027', 'Singapore', 'Singapore', 'Singapore', '2027-10-08|2027-10-10', false],
    [19, 'united-states', 'Formula 1 Pirelli United States Grand Prix 2027', 'United States', 'Austin', 'United States', '2027-10-22|2027-10-24', false],
    [20, 'mexico', 'Formula 1 Gran Premio de la Ciudad de Mexico 2027', 'Mexico City', 'Mexico City', 'Mexico', '2027-10-29|2027-10-31', false],
    [21, 'brazil', 'Formula 1 Heineken Grande Premio de Sao Paulo 2027', 'Sao Paulo', 'Sao Paulo', 'Brazil', '2027-11-05|2027-11-07', true],
    [22, 'las-vegas', 'Formula 1 Heineken Las Vegas Grand Prix 2027', 'Las Vegas', 'Las Vegas', 'United States', '2027-11-18|2027-11-20', false],
    [23, 'qatar', 'Formula 1 Qatar Airways Qatar Grand Prix 2027', 'Qatar', 'Lusail', 'Qatar', '2027-12-03|2027-12-05', true],
    [24, 'abu-dhabi', 'Formula 1 Etihad Airways Abu Dhabi Grand Prix 2027', 'Abu Dhabi', 'Abu Dhabi', 'United Arab Emirates', '2027-12-10|2027-12-12', true],
];
export const RACES_2027 = rows.map(([round, slug, name, shortName, locality, country, span, hasSprint]) => {
    const [weekendStart, weekendEnd] = span.split('|');
    const id = `2027-r${round}-${slug}`;
    return {
        id, season: 2027, round, name, shortName, circuit: null, locality, country,
        weekendStart, weekendEnd, raceDate: weekendEnd, hasSprint, themeId: id, status: 'scheduled',
    };
});
