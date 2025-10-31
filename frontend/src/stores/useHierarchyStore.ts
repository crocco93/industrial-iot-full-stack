import { create } from 'zustand';
import type { Location, Area, Device, DataPoint } from '@/types/hierarchy';

interface HierarchyState {
  locations: Location[];
  selectedNode: any | null;
  expandedNodes: Set<string>;

  setLocations: (locations: Location[]) => void;
  addLocation: (location: Location) => void;
  updateLocation: (id: string, location: Partial<Location>) => void;
  deleteLocation: (id: string) => void;

  setSelectedNode: (node: any) => void;
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
}

export const useHierarchyStore = create<HierarchyState>((set) => ({
  locations: [
    {
      id: '1',
      name: 'Manufacturing Plant Warsaw',
      description: 'Main production facility',
      address: 'Industrial District 1, Warsaw, Poland',
      devices: [
        {
          id: 'infra-1',
          name: 'Main Power Meter',
          type: 'infrastructure',
          protocol_type: 'modbus-tcp',
          configuration: { host: '192.168.1.50', port: 502, unit_id: 1 },
          data_points: [],
          status: 'connected',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      areas: [
        {
          id: 'area-1',
          name: 'Assembly Line Alpha',
          location_id: '1',
          devices: [
            {
              id: 'prod-1',
              name: 'Line Controller PLC',
              type: 'production',
              protocol_type: 'modbus-tcp',
              configuration: { host: '192.168.2.100', port: 502, unit_id: 1 },
              data_points: [],
              status: 'connected',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  selectedNode: null,
  expandedNodes: new Set(['1']),

  setLocations: (locations) => set({ locations }),
  addLocation: (location) => set((state) => ({ locations: [...state.locations, location] })),
  updateLocation: (id, update) =>
    set((state) => ({
      locations: state.locations.map((loc) => (loc.id === id ? { ...loc, ...update } : loc)),
    })),
  deleteLocation: (id) =>
    set((state) => ({ locations: state.locations.filter((loc) => loc.id !== id) })),

  setSelectedNode: (node) => set({ selectedNode: node }),
  expandNode: (nodeId) => set((state) => ({ expandedNodes: new Set([...state.expandedNodes, nodeId]) })),
  collapseNode: (nodeId) =>
    set((state) => {
      const next = new Set(state.expandedNodes);
      next.delete(nodeId);
      return { expandedNodes: next };
    }),
}));
