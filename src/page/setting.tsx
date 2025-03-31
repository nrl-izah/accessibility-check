import { h } from "preact";
import { useState, useEffect } from "preact/hooks";

const SettingsPage = () => {
  const [customContrast, setCustomContrast] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Load saved contrast ratio when settings page opens
  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: "get-custom-contrast" } }, "*");
  }, []);

  // Handle receiving stored value
  useEffect(() => {
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      if (msg.type === "loaded-custom-contrast") {
        setCustomContrast(msg.value);
      }
    };
  }, []);

  const handleInputChange = (e: Event) => {
    const value = parseFloat((e.target as HTMLInputElement).value);

    if (isNaN(value) || value < 1 || value > 21) {
      setErrorMessage("Contrast ratio must be between 1 and 21.");
    } else {
      setErrorMessage(""); // Clear error when valid
    }

    setCustomContrast(isNaN(value) ? null : value);
  };

  const handleSave = () => {
    if (customContrast !== null && customContrast >= 1 && customContrast <= 21) {
      parent.postMessage({ pluginMessage: { type: "save-custom-contrast", value: customContrast } }, "*");
      figma.notify("Custom contrast ratio saved!");
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold">Customization</h2>
      <label className="block text-sm font-semibold mt-4">Custom Contrast Ratio</label>
      <input
        type="number"
        min="1"
        max="21"
        step="0.1"
        placeholder="Enter a number range from 1 to 21"
        value={customContrast ?? ""}
        onInput={(e) => setCustomContrast(parseFloat((e.target as HTMLInputElement).value))}
        className="w-full p-2 border rounded-md mt-1"
      />
      {errorMessage && <p className="text-red-500 text-sm mt-1">{errorMessage}</p>}
      <div className="row">
        <div className="result">
            <button
                className="feature px-4 py-2 rounded-lg mt-2"
                onClick={handleSave}
            >
                Save
            </button>
        </div>
        </div>
    </div>
  );
};

export default SettingsPage;
