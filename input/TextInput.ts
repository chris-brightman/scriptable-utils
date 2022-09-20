import { getRandomArrayItem } from '../common';
import { BUTTON_TEXTS } from '../privateConfig';
import alert from './alert';
import { TextFieldConfigOpts, TextFieldKeyboardFlavor } from './types';

type Opts = {
  message?: string;
  submitText?: string;
  cancelText?: string;
  onSubmit?: MapFn<string | null, any>;
  onCancel?: NoParamFn;
  flavor?: TextFieldKeyboardFlavor;
  showClipboardButton?: boolean;
} & TextFieldConfigOpts;

export default async (
  title = 'Enter text',
  {
    submitText = getRandomArrayItem(BUTTON_TEXTS),
    cancelText = 'Cancel',
    onSubmit = () => {},
    onCancel = () => {},
    message,
    initValue,
    placeholder,
    flavor,
    showClipboardButton = false,
  }: Opts = {}
) => {
  const clipboardValue = showClipboardButton && Pasteboard.paste();
  const USE_CLIPBOARD_LABEL = `📋 ${clipboardValue}`;
  const {
    textFieldResults: { inputText },
    tappedButtonText,
  } = await alert<'inputText'>({
    title,
    message,
    buttons: {
      [cancelText]: { isCancel: true },
      ...(showClipboardButton &&
        clipboardValue && { [USE_CLIPBOARD_LABEL]: {} }),
      [submitText]: {},
    },
    textFields: { inputText: { placeholder, initValue, flavor } },
  });

  const shouldUseClipboard = tappedButtonText === USE_CLIPBOARD_LABEL;
  const resultText = (shouldUseClipboard && clipboardValue) || inputText;

  const wasCancelled = tappedButtonText === cancelText;
  wasCancelled ? await onCancel() : await onSubmit(resultText);
  return wasCancelled ? '' : resultText;
};
