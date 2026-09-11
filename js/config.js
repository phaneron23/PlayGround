export const CFG = {
  world: 76,
  camDist: 42,
  camMin: 18,
  camMax: 70,
  costs: {
    peasant: { gold: 50, wood: 0, food: 1, time: 6 },
    footman: { gold: 120, wood: 20, food: 2, time: 9 },
    farm: { gold: 0, wood: 100, food: 0, time: 8 },
  },
  stats: {
    peasant: { hp: 55, dmg: 4, range: 1.9, cooldown: 1.1, speed: 7.2, sight: 12 },
    footman: { hp: 135, dmg: 9, range: 2.2, cooldown: 1.0, speed: 6.2, sight: 13 },
    grunt: { hp: 150, dmg: 11, range: 2.2, cooldown: 1.1, speed: 5.8, sight: 14 },
    townHall: { hp: 1000 },
    farm: { hp: 350 },
    stronghold: { hp: 1200 },
    tower: { hp: 450, dmg: 12, range: 14, cooldown: 1.4 },
  },
  harvest: { carry: 10, time: 1.4 },
  wave: { first: 75, every: 80, base: 2, growth: 1 },
};
