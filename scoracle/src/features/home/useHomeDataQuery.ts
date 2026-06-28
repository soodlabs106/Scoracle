import { useQuery } from '@tanstack/react-query'
import { fetchHomeData } from '../../data/homeData'
import { applyPredictionSimulationToHomeData } from '../../data/predictionSimulation'

export const homeDataQueryKey = ['home-data'] as const

export function useHomeDataQuery() {
  return useQuery({
    queryKey: homeDataQueryKey,
    queryFn: async () => applyPredictionSimulationToHomeData(await fetchHomeData()),
  })
}
