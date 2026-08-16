// Style reminder: "حديقة الأصباغ الزجاجية" — أنابيب سائلة هي البطلة، مع ورق عاجي دافئ وأخضر نعناعي وبتلات مكافأة هادئة.
import { useEffect, useRef, useState } from "react";
import { RotateCcw, Undo2, Map, X, Play, LockKeyhole, Sprout } from "lucide-react";
import { mountColorPourGame } from "../game/script.js";

type GameStats = { levelId: number; levelName: string; moveCount: number; canUndo: boolean };
type LevelData = { id: number; name: string; difficulty: string };
type GameController = { destroy: () => void; restart: () => void; undo: () => void; loadLevel: (id: number) => void };

const LOGO_URL = "/manus-storage/color-pour-logo-mark_b59688f7.png";
const TUBE_URL = "/manus-storage/color-pour-tube-illustration_f559deb3.png";
const PETAL_URL = "/manus-storage/color-pour-petal-sprig_4029e62a.png";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<GameController | null>(null);
  const [stats, setStats] = useState<GameStats>({ levelId: 1, moveCount: 0, canUndo: false, levelName: "Bloom 01" });
  const [levels, setLevels] = useState<LevelData[]>([]);
  const [highestUnlocked, setHighestUnlocked] = useState(1);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [wonLevel, setWonLevel] = useState<number | null>(null);

  useEffect(() => {
    let disposed = false;
    if (!canvasRef.current) return;
    mountColorPourGame(canvasRef.current, {
      onStats: (nextStats) => !disposed && setStats(nextStats),
      onLevels: (nextLevels: LevelData[], unlocked: number) => {
        if (!disposed) {
          setLevels(nextLevels);
          setHighestUnlocked(unlocked);
        }
      },
      onWin: (levelId: number, unlocked: number) => {
        if (!disposed) {
          setWonLevel(levelId);
          setHighestUnlocked(unlocked);
        }
      },
    }).then((controller: GameController) => {
      if (disposed) controller.destroy();
      else gameRef.current = controller;
    });
    return () => {
      disposed = true;
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, []);

  const selectLevel = (levelId: number) => {
    if (levelId <= highestUnlocked) {
      gameRef.current?.loadLevel(levelId);
      setPickerOpen(false);
      setWonLevel(null);
    }
  };

  const nextLevel = () => {
    const next = Math.min(stats.levelId + 1, levels.length || stats.levelId);
    gameRef.current?.loadLevel(next);
    setWonLevel(null);
  };

  return (
    <main className="game-shell" aria-label="Color Pour: Sort and Bloom">
      <div className="paper-grain" aria-hidden="true" />
      <header className="game-header">
        <div className="brand-lockup">
          <img className="brand-mark" src={LOGO_URL} alt="" />
          <div>
            <p className="eyebrow">حديقة الألوان</p>
            <h1>Color Pour</h1>
          </div>
        </div>
        <div className="level-chip" aria-live="polite">
          <Sprout size={15} strokeWidth={2.4} />
          <span>{stats.levelName}</span>
        </div>
      </header>

      <section className="play-stage" aria-label="لوحة ترتيب الألوان">
        <div className="stage-caption">
          <span>الحركات</span>
          <strong>{stats.moveCount}</strong>
        </div>
        <canvas ref={canvasRef} className="game-canvas" aria-label="اضغط على أنبوب ثم على أنبوب مناسب لنقل اللون" />
      </section>

      <nav className="control-dock" aria-label="أدوات اللعبة">
        <button type="button" className="tool-button" onClick={() => gameRef.current?.restart()} aria-label="إعادة المرحلة">
          <RotateCcw size={21} />
          <span>إعادة</span>
        </button>
        <button type="button" className="tool-button main-tool" onClick={() => gameRef.current?.undo()} disabled={!stats.canUndo} aria-label="التراجع عن آخر حركة">
          <Undo2 size={22} />
          <span>تراجع</span>
        </button>
        <button type="button" className="tool-button" onClick={() => setPickerOpen(true)} aria-label="اختيار مرحلة">
          <Map size={21} />
          <span>المراحل</span>
        </button>
      </nav>

      <p className="game-hint">رتّب اللون، ودَع حديقتك تزهر.</p>

      {isPickerOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="اختيار مرحلة">
          <section className="level-sheet">
            <button className="close-button" type="button" onClick={() => setPickerOpen(false)} aria-label="إغلاق"><X size={20} /></button>
            <div className="sheet-heading">
              <img src={TUBE_URL} alt="" />
              <div>
                <p className="eyebrow">اختر الإزهار التالي</p>
                <h2>خريطة الحديقة</h2>
              </div>
            </div>
            <div className="level-grid">
              {levels.map((level) => {
                const available = level.id <= highestUnlocked;
                const active = level.id === stats.levelId;
                return (
                  <button
                    type="button"
                    key={level.id}
                    disabled={!available}
                    onClick={() => selectLevel(level.id)}
                    className={`level-tile ${active ? "active" : ""} ${available ? "" : "locked"}`}
                    aria-label={available ? `المرحلة ${level.id}` : `المرحلة ${level.id} مقفلة`}
                  >
                    {available ? <span>{String(level.id).padStart(2, "0")}</span> : <LockKeyhole size={17} />}
                    <small>{level.difficulty}</small>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {wonLevel !== null && (
        <div className="modal-backdrop win-backdrop" role="dialog" aria-modal="true" aria-label="اكتملت المرحلة">
          <section className="win-card">
            <img className="petal-sprig" src={PETAL_URL} alt="" />
            <p className="eyebrow">إزهار مكتمل</p>
            <h2>ترتيب جميل</h2>
            <p>نمت زهرة جديدة في حديقتك. أكمل السكب إلى المرحلة التالية.</p>
            <div className="win-actions">
              <button type="button" className="secondary-action" onClick={() => setPickerOpen(true)}>خريطة المراحل</button>
              <button type="button" className="primary-action" onClick={nextLevel}>
                <span>التالي</span><Play size={16} fill="currentColor" />
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
