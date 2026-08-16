export type GameStats = { levelId: number; levelName: string; moveCount: number; canUndo: boolean };
export type LevelData = { id: number; name: string; difficulty: string };
export type GameController = { destroy: () => void; restart: () => void; undo: () => void; loadLevel: (id: number) => void };

export function mountColorPourGame(
  canvas: HTMLCanvasElement,
  callbacks: {
    onStats?: (stats: GameStats) => void;
    onLevels?: (levels: LevelData[], highestUnlocked: number) => void;
    onWin?: (levelId: number, highestUnlocked: number) => void;
  },
): Promise<GameController>;
