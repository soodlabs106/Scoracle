import { useQuery } from '@tanstack/react-query'
import { fallbackHomeData, fetchHomeData } from '../../data/homeData'
import { applyPredictionSimulationToHomeData } from '../../data/predictionSimulation'

export const homeDataQueryKey = ['home-data'] as const

export function useHomeDataQuery(authScope: string | null = null) {
  return useQuery({
    queryKey: [...homeDataQueryKey, authScope ? 'authenticated' : 'anonymous'],
    placeholderData: fallbackHomeData,
    queryFn: async () => applyPredictionSimulationToHomeData(await fetchHomeData()),
    refetchInterval: (query) => {
      const data = query.state.data
      const hasLiveFixture = data?.fixtures.some(
        (fixture) => fixture.statusPhase === 'LIVE',
      )

      return hasLiveFixture ? 30_000 : 60_000
    },
    refetchIntervalInBackground: true,
  })
}
