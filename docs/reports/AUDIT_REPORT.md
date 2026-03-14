# Audit Report - React Duplication
## pnpm -r why react
Legend: production dependency, optional only, dev only

@sinprfes/assembleia-app@0.0.0 /app/assembleia-app (PRIVATE)

dependencies:
lucide-react 0.574.0
└── react 19.2.4 peer
react 19.2.4
react-dom 19.2.4
└── react 19.2.4 peer
zustand 5.0.11
├── react 19.2.4 peer
└─┬ use-sync-external-store 1.6.0 peer
  └── react 19.2.4 peer

@sinprfes/mobile@1.0.0 /app/mobile (PRIVATE)

dependencies:
@expo/vector-icons 15.0.3
└─┬ expo-font 14.0.11 peer
  └─┬ expo 54.0.33 peer
    ├─┬ @expo/cli 54.0.23
    │ └─┬ react-native 0.81.5 peer
    │   ├─┬ @react-native/virtualized-lists 0.81.5
    │   │ └── react 19.1.0 peer
    │   └── react 19.1.0 peer
    ├─┬ @expo/devtools 0.1.8
    │ ├── react 19.1.0 peer
    │ └─┬ react-native 0.81.5 peer
    │   ├─┬ @react-native/virtualized-lists 0.81.5
    │   │ └── react 19.1.0 peer
    │   └── react 19.1.0 peer
    └─┬ expo-asset 12.0.12
      ├─┬ expo-constants 18.0.13
      │ └─┬ react-native 0.81.5 peer
      │   ├─┬ @react-native/virtualized-lists 0.81.5
      │   │ └── react 19.1.0 peer
      │   └── react 19.1.0 peer
      ├── react 19.1.0 peer
      └─┬ react-native 0.81.5 peer
        ├─┬ @react-native/virtualized-lists 0.81.5
        │ └── react 19.1.0 peer
        └── react 19.1.0 peer
## pnpm -r list react --depth 10
Legend: production dependency, optional only, dev only

@sinprfes/assembleia-app@0.0.0 /app/assembleia-app (PRIVATE)

dependencies:
lucide-react 0.574.0
└── react 19.2.4 peer
react 19.2.4
react-dom 19.2.4
└── react 19.2.4 peer
zustand 5.0.11
├── react 19.2.4 peer
└─┬ use-sync-external-store 1.6.0 peer
  └── react 19.2.4 peer

@sinprfes/mobile@1.0.0 /app/mobile (PRIVATE)

dependencies:
@expo/vector-icons 15.0.3
└─┬ expo-font 14.0.11 peer
  └─┬ expo 54.0.33 peer
    ├─┬ @expo/cli 54.0.23
    │ └─┬ react-native 0.81.5 peer
    │   ├─┬ @react-native/virtualized-lists 0.81.5
    │   │ └── react 19.1.0 peer
    │   └── react 19.1.0 peer
    ├─┬ @expo/devtools 0.1.8
    │ ├── react 19.1.0 peer
    │ └─┬ react-native 0.81.5 peer
    │   ├─┬ @react-native/virtualized-lists 0.81.5
    │   │ └── react 19.1.0 peer
    │   └── react 19.1.0 peer
    └─┬ expo-asset 12.0.12
      ├─┬ expo-constants 18.0.13
      │ └─┬ react-native 0.81.5 peer
      │   ├─┬ @react-native/virtualized-lists 0.81.5
      │   │ └── react 19.1.0 peer
      │   └── react 19.1.0 peer
      ├── react 19.1.0 peer
      └─┬ react-native 0.81.5 peer
        ├─┬ @react-native/virtualized-lists 0.81.5
        │ └── react 19.1.0 peer
        └── react 19.1.0 peer
## pnpm -r why react-native
## pnpm -r why @react-native-community/netinfo
Legend: production dependency, optional only, dev only

@sinprfes/mobile@1.0.0 /app/mobile (PRIVATE)

dependencies:
@react-native-community/netinfo 11.4.1
