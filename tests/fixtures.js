export const MISSING = '\\N';

function result(fields) {
  return {
    number: '7', grid: '1', position: '1', positionText: '1', positionOrder: '1',
    points: '10', laps: '50', time: MISSING, milliseconds: MISSING,
    fastestLap: '20', rank: '2', fastestLapTime: '1:20.500',
    fastestLapSpeed: '215.25', statusId: '1', ...fields,
  };
}

function race(raceId, year, round, name, date) {
  return { raceId, year, round, circuitId: '1', name, date, time: MISSING };
}

export function makeRawData() {
  return {
    drivers: [
      { driverId: '2', driverRef: 'other', forename: 'Bob', surname: 'Other', number: MISSING, code: MISSING },
      { driverId: '3', driverRef: 'unused', forename: 'No', surname: 'Results', number: '' },
      { driverId: '1', driverRef: 'racer', forename: 'Amy', surname: 'Racer', number: '7', code: 'RAC' },
    ],
    constructors: [
      { constructorId: '10', constructorRef: 'later_team', name: 'Alpha Later' },
      { constructorId: '20', constructorRef: 'first_team', name: 'Zeta First' },
    ],
    races: [
      race('104', '2001', '1', 'Fourth Grand Prix', '2001-03-01'),
      race('103', '2000', '3', 'Third Grand Prix', '2000-05-01'),
      race('101', '2000', '1', 'First Grand Prix', '2000-03-01'),
      race('106', '2050', '1', 'Scheduled Grand Prix', '2050-03-01'),
      race('102', '2000', '2', 'Second Grand Prix', '2000-04-01'),
      race('105', '1999', '1', 'Other Grand Prix', '1999-03-01'),
    ],
    status: [
      { statusId: '1', status: 'Finished' },
      { statusId: '2', status: 'Disqualified' },
      { statusId: '5', status: 'Engine' },
      { statusId: '11', status: '+1 Lap' },
      { statusId: '12', status: '+2 Laps' },
      { statusId: '54', status: 'Withdrew' },
      { statusId: '62', status: 'Not classified' },
      { statusId: '77', status: '107% Rule' },
      { statusId: '81', status: 'Did not qualify' },
      { statusId: '96', status: 'Excluded' },
      { statusId: '97', status: 'Did not prequalify' },
    ],
    results: [
      result({ resultId: '1004', raceId: '104', driverId: '1', constructorId: '10', position: '3', positionText: '3', positionOrder: '3', points: '4', statusId: '11' }),
      result({ resultId: '1002', raceId: '102', driverId: '1', constructorId: '10', position: '2', positionText: '2', positionOrder: '2', points: '6' }),
      result({ resultId: '1005', raceId: '105', driverId: '2', constructorId: '10', position: '5', positionText: '5', positionOrder: '5', points: '2' }),
      result({ resultId: '1003', raceId: '103', driverId: '1', constructorId: '20', grid: '0', position: MISSING, positionText: 'R', positionOrder: '15', points: '0', statusId: '5' }),
      result({ resultId: '1001', raceId: '101', driverId: '1', constructorId: '20' }),
    ],
  };
}

export function allNodes(root) {
  return root ? [root, ...(root.children ?? []).flatMap(allNodes)] : [];
}

export function raceNodes(root) {
  return allNodes(root).filter((node) => node.type === 'race');
}

export function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
