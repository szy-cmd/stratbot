import { useState, useCallback } from 'react';
import { TURNS } from '../data/mockRaceState';

/**
 * Turn-based simulation state (chess-like).
 * currentTurnIndex advances when user picks a branch; branches/probs are from mock data.
 */
export function useSimulation() {
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [selectedBranchIds, setSelectedBranchIds] = useState({});

  const currentTurn = TURNS[currentTurnIndex];
  const isLastTurn = currentTurnIndex >= TURNS.length - 1;
  const hasNextTurn = currentTurnIndex < TURNS.length - 1;
  const hasPrevTurn = currentTurnIndex > 0;

  const selectBranch = useCallback((branchId, turnIndex) => {
    const idx = turnIndex != null ? turnIndex : currentTurnIndex;
    setSelectedBranchIds((prev) => ({ ...prev, [idx]: branchId }));
    setCurrentTurnIndex(idx);
  }, [currentTurnIndex]);

  const goNextTurn = useCallback(() => {
    if (hasNextTurn) setCurrentTurnIndex((i) => i + 1);
  }, [hasNextTurn]);

  const goPrevTurn = useCallback(() => {
    if (hasPrevTurn) setCurrentTurnIndex((i) => i - 1);
  }, [hasPrevTurn]);

  const resetSimulation = useCallback(() => {
    setCurrentTurnIndex(0);
    setSelectedBranchIds({});
  }, []);

  return {
    currentTurn,
    currentTurnIndex,
    totalTurns: TURNS.length,
    selectedBranchIds,
    selectBranch,
    goNextTurn,
    goPrevTurn,
    hasNextTurn,
    hasPrevTurn,
    isLastTurn,
    resetSimulation,
  };
}
