import React, { createContext, useCallback, useState } from 'react';

export const FocusContext = createContext();

export const FocusProvider = ({ children }) => {
  const [focusState, setFocusState] = useState({
    focusedElement: null, // 'location', 'route', 'heatmapCell', 'legendItem', null
    focusedId: null, // location ID, route ID, legend category key, etc.
    focusMode: null, // 'tap', 'search', 'legend', 'auto', null
  });

  const setFocus = useCallback((type, id, mode = 'tap') => {
    setFocusState({
      focusedElement: type,
      focusedId: id,
      focusMode: mode,
    });
  }, []);

  const toggleFocus = useCallback((type, id) => {
    setFocusState((prev) => {
      if (prev.focusedElement === type && prev.focusedId === id) {
        // Clear focus if clicking same element twice
        return {
          focusedElement: null,
          focusedId: null,
          focusMode: null,
        };
      }
      return {
        focusedElement: type,
        focusedId: id,
        focusMode: 'tap',
      };
    });
  }, []);

  const clearFocus = useCallback(() => {
    setFocusState({
      focusedElement: null,
      focusedId: null,
      focusMode: null,
    });
  }, []);

  const value = {
    ...focusState,
    setFocus,
    toggleFocus,
    clearFocus,
    isFocused: (type, id) => focusState.focusedElement === type && focusState.focusedId === id,
    hasFocus: focusState.focusedElement !== null,
  };

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
};

export const useFocus = () => {
  const context = React.useContext(FocusContext);
  if (!context) {
    throw new Error('useFocus must be used within a FocusProvider');
  }
  return context;
};
