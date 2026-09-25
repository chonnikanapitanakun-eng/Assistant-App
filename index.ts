// App entry. The Android widget's headless task must be registered before the app mounts,
// so it also works when Android starts the JS runtime just to draw the widget.
import './src/features/widgets/register';
import 'expo-router/entry';
