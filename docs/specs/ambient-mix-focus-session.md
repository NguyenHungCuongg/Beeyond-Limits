# Spec: Ambient Mix for Focus Session

## Objective

Allow a Focus Session and a saved template to capture a multi-sound ambient
mix. This makes a repeatable session include the user’s chosen soundscape,
instead of limiting it to one dropdown selection.

## Success criteria

- A user can enable any combination of the six existing ambient sounds and set
  each volume independently in Focus Setup.
- Focus Session start applies only its snapshot mix; pause stops it; resume
  restores it; terminal paths restore the pre-session Quick Tool mix.
- Templates persist the complete mix. Legacy `soundId` configurations migrate
  to a one-sound mix without data loss.
- The Quick Tool and Focus Session continue to share the existing offscreen
  audio engine; no new dependency or audio engine is introduced.

## Data model

```js
ambientSound: {
  enabled: true,
  sounds: {
    rain: { enabled: true, volume: 70 },
    thunder: { enabled: true, volume: 20 },
  },
}
```

`soundId` remains accepted only as legacy input and becomes a one-sound mix.

## Boundaries

- Always: normalize sound IDs and volumes; test migration and lifecycle.
- Ask first: add audio files or third-party dependencies.
- Never: mutate Quick Tool ambient settings permanently as a side effect of a
  Focus Session.
