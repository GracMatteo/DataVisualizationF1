import { createContext, useContext, useReducer } from 'react'

export const INITIAL = {
  view: 'overview',
  season: null,
  countries: [],
  driverId: null,
  constructorId: null,
  circuitId: null,
  raceId: null,
  compareDriverId: null,
  compareConstructorId: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'set':
      return { ...state, ...action.patch }
    case 'toggleCountry': {
      const has = state.countries.includes(action.country)
      return { ...state, countries: has ? state.countries.filter((c) => c !== action.country) : [...state.countries, action.country] }
    }
    case 'reset':
      return { ...INITIAL, view: state.view }
    default:
      return state
  }
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const value = useReducer(reducer, INITIAL)
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const [state, dispatch] = useContext(StoreContext)
  const set = (patch) => dispatch({ type: 'set', patch })
  return { state, dispatch, set }
}

const ModelContext = createContext(null)
export const ModelProvider = ModelContext.Provider
export const useModel = () => useContext(ModelContext)
