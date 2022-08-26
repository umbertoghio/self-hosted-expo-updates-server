Currently Expo prebuild (managed) do not suport additional request headers, necessary to set the release channel.
Those can be setup manually in ejected apps, I have created a patch for expo-config that can be applied from this folder (see package.json expo-patch).
PR has been requested: https://github.com/expo/expo/pull/18737