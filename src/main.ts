import { showUI, on, emit } from '@create-figma-plugin/utilities';
import { Buffer } from 'buffer';


export default function () {
  let contrastCheckHandler: (() => void) | null = null;
  let touchCheckHandler: (() => void) | null = null;
  let simulateCVDHandler: (() => void) | null = null;

  let userDefinedContrast = 4.5; // Default to WCAG AA


  showUI({
    height: 600,
    width: 400
  })

  figma.clientStorage.getAsync("customContrast").then((storedValue) => {
    if (storedValue) {
      userDefinedContrast = storedValue;
    }
  });

  // Listen for messages

  figma.ui.onmessage = async (msg) => {
    if (msg.type === 'start-auto-scan') {
      console.log('Direct handler: Starting auto-scan...');
      autoScan();
    } 
    if (msg.type === 'start-color-contrast') {
      console.log('Starting color contrast check...');
      handleContrastCheck();
      handleGenerateSuggestionII(userDefinedContrast);
      contrastCheckHandler = () => {
        console.log("Selection changed:", figma.currentPage.selection);
        handleContrastCheck();
        handleGenerateSuggestionII(userDefinedContrast);
        // figma.ui.postMessage({
        //   type: 'reset-suggestion',
        //   data: '',
        // });
      };
      figma.on('selectionchange', contrastCheckHandler);
    } 
    if (msg.type === 'stop-color-contrast') {
      console.log('Stopping color contrast check...');
      if (contrastCheckHandler) {
          figma.off('selectionchange', contrastCheckHandler);
          contrastCheckHandler = null;
      }
    }
    if (msg.type === 'start-touch-target') {
      console.log('Starting touch target check...');
      handleTouchTargetCheck();

      touchCheckHandler = () => {
        console.log("Selection changed:", figma.currentPage.selection);
        handleTouchTargetCheck();
      };
      figma.on('selectionchange', touchCheckHandler);
    } 
    if (msg.type === 'stop-touch-check') {
      console.log('Stop touch target check...');

      if (touchCheckHandler) {
        figma.off('selectionchange', touchCheckHandler);
        touchCheckHandler = null;
      }
    } 
    if (msg.type === 'start-vision-simulator') {
      console.log('Starting vision simulator...');
      handleVisionSimulator();
      simulateCVDHandler = () => {
        console.log("Selection changed:", figma.currentPage.selection);
        handleVisionSimulator();
      };
      figma.on('selectionchange', simulateCVDHandler);
    }
    if (msg.type === 'stop-vision-simulator') {
      console.log('Stopping vision simulator...');
      if (simulateCVDHandler) {
        figma.off('selectionchange', simulateCVDHandler)
        simulateCVDHandler = null;
      }
    }
    if (msg.type === "save-custom-contrast") {
      const contrastValue = msg.value;
    
      // Validate contrast ratio range (1 to 21)
      if (typeof contrastValue !== "number" || contrastValue < 1 || contrastValue > 21) {
        figma.ui.postMessage({ type: "error", message: "Contrast ratio must be between 1 and 21." });
        figma.notify("Contrast ratio must be between 1 and 21.");
        return;
      }
    
      userDefinedContrast = contrastValue;
      await figma.clientStorage.setAsync("customContrast", contrastValue);
      figma.notify("Custom contrast ratio saved!");
    }
  
    if (msg.type === "get-custom-contrast") {
      const storedValue = await figma.clientStorage.getAsync("customContrast");
      if (storedValue == 4.5) {
        figma.ui.postMessage({ type: "loaded-custom-contrast", value: "" });
      }
      else {
        figma.ui.postMessage({ type: "loaded-custom-contrast", value: storedValue || "" });
      }
    }

    if (msg.type === "reset-custom-contrast") {
      const defaultContrast = 4.5;
      userDefinedContrast = defaultContrast;
      await figma.clientStorage.setAsync("customContrast", defaultContrast);
      figma.notify("Custom contrast ratio reset to default.");
    }
    
    if (msg.type === "select-layer" && msg.id) {
      console.log('Starting select layer...');
      const node = figma.getNodeById(msg.id);
      // Check if the node is a SceneNode
      if (node && node.type !== "PAGE" && "visible" in node) {
        figma.currentPage.selection = [node as SceneNode];
        // figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
      } else {
        figma.notify("Layer not found or is not a selectable canvas element!");
      }
    }
    // else if (msg.type === 'start-suggest-color') {
    //   console.log('Starting suggest color...');
    //   const selection = figma.currentPage.selection;

    //   if (selection.length === 0) {
    //     console.log('No object selected.');
    //     figma.ui.postMessage({
    //       type: 'suggestion-results',
    //       data: { error: 'No object selected for suggestions.' },
    //     });
    //     return;
    //   }
    //   handleGenerateSuggestion();
    // }
    if (msg.type === 'start-suggest-color-II') {
      console.log('Starting suggest color...');
      const selection = figma.currentPage.selection;

      if (selection.length === 0) {
        console.log('No object selected.');
        figma.ui.postMessage({
          type: 'suggestion-results-II',
          data: { error: 'No object selected for suggestions.' },
        });
        return;
      }
      handleGenerateSuggestionII(userDefinedContrast);

    } 
    if (msg.type === "apply-color" && msg.color) {
      const selectedNode = figma.currentPage.selection[0];
      console.log(msg.color);


  
      if (selectedNode && "fills" in selectedNode) {
        const fills = clone(selectedNode.fills);
  
        fills[0] = {
          type: "SOLID",
          color: {
            r: msg.color.r / 255,
            g: msg.color.g / 255,
            b: msg.color.b / 255
          }
        };
  
        selectedNode.fills = fills;
      }
      figma.notify("New color applied to selected element!");
    }
    if (msg.type === "apply-color-all" && msg.color && msg.original) {
      const selectedNode = figma.currentPage.selection[0];
      console.log(msg.color);
      console.log(msg.original);
      const suggestedRGB = msg.color;
      const foreRGB = msg.original;
    
      const matchingNodes = figma.currentPage.findAll((node) => {
        return "fills" in node && Array.isArray(node.fills);
      }) as (SceneNode & { fills: readonly Paint[] })[];
  
      // Loop through nodes and apply the suggested color if they match the original color
      matchingNodes.forEach((node) => {
        const fills = node.fills as Paint[];
        if (fills.length > 0 && fills[0].type === "SOLID") {
          const { r, g, b } = fills[0].color;
  
          // Check if the fill color matches the original color (foreRGB)
          if (
            Math.abs(r * 255 - foreRGB.r) < 1 &&
            Math.abs(g * 255 - foreRGB.g) < 1 &&
            Math.abs(b * 255 - foreRGB.b) < 1
          ) {
            // Apply the suggested color
            const newFills = [...fills];
            newFills[0] = {
              type: "SOLID",
              color: {
                r: suggestedRGB.r / 255,
                g: suggestedRGB.g / 255,
                b: suggestedRGB.b / 255,
              },
            };
            node.fills = newFills;
          }
        }
      });
      console.log(`Updated ${matchingNodes.length} elements with the new color.`);
      figma.notify("New color applied!");

    }    
    if (msg.type === "save-report") {
      const uint8Array = new Uint8Array(msg.image);
      const image = figma.createImage(uint8Array);
      const imageNode = figma.createRectangle();

      imageNode.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: image.hash }];

      const selectedNodes = figma.currentPage.selection;
      if (selectedNodes.length === 0) {
        figma.notify("Please select a layer first.");
        return;
      }
      const selectedNode = selectedNodes[0];

      image.getSizeAsync().then(({ width, height }) => {
        const fixedWidth = 400; // Keep width fixed
        const aspectRatio = width / height;
        const adjustedHeight = fixedWidth / aspectRatio; // Adjust height dynamically

        imageNode.resize(fixedWidth, adjustedHeight);

        // Check if the selected node is inside a frame
        let parentNode = selectedNode.parent;
        if (parentNode && parentNode.type === "FRAME") {
          // Adjust position of the image outside the frame
          imageNode.x = parentNode.x + parentNode.width + 50;
          imageNode.y = selectedNode.y;  // Align with the same Y position as the node
        } else {
          // If the node is not inside a frame, place it based on the node's position
          imageNode.x = selectedNode.x + selectedNode.width + 20;
          imageNode.y = selectedNode.y;
        }

        figma.currentPage.appendChild(imageNode);
      });
    }
    if (msg.type === "simulated-image" && msg.simulationType && pendingSimulations[msg.simulationType]) {
      pendingSimulations[msg.simulationType](msg.dataURL);
      delete pendingSimulations[msg.simulationType];
    }
  };
}

const getAllChildren = (node: SceneNode): SceneNode[] => {
  const children: SceneNode[] = [];
  if ("children" in node) {
    for (const child of node.children) {
      children.push(child, ...getAllChildren(child)); // Recursively collect all nested children
    }
  }
  return children;
};


const autoScan = async (): Promise<void> => {
  const frames = figma.currentPage.findAll(node =>
    node.type === "FRAME" || node.type === "GROUP" || node.type === "COMPONENT" || node.type === "INSTANCE"
  ) as FrameNode[];

  // Separate lists for different categories of violations
  const contrastViolations: {
    layerId: string;
    frame: string;
    layer: string;
    contrastRatio: string;
    issueDescription: string;
  }[] = [];

  const touchTargetViolations: {
    layerId: string;
    frame: string;
    layer: string;
    width: number;
    height: number;
    issueDescription: string;
  }[] = [];



  for (const frame of frames) {
    // Use Promise.all to wait for all async operations within the loop
    // const allLayers = getAllChildren(frame);
    await Promise.all(frame.children.map(async (layer) => {
      // Skip non-relevant layers
      if (!("fills" in layer) || !Array.isArray(layer.fills) || layer.fills.length === 0) return;

      // Handle color contrast check
      const fillColor = getColors(layer);
      if (fillColor) {
        const backgroundNode = getBackgroundNode(layer);
        const backgroundColor = backgroundNode
          ? getColors(backgroundNode)
          : { r: 255, g: 255, b: 255 }; // Default to white background

          if (backgroundColor) {
            const contrastRatio = calculateContrastRatio(fillColor, backgroundColor);
            const results = evaluateContrast(contrastRatio);

            let contrastIssueDescription = "";
            const failsAA = results.AA_NormalText === "false";
            const failsAAA = results.AAA_NormalText === "false";
            const failsAALarge = results.AA_LargeText === "false";
            const failsAAALarge = results.AAA_LargeText === "false";

            if (failsAALarge && failsAA && failsAAALarge && failsAAA) {
              contrastIssueDescription = "Contrast is extremely low. Low vision people may be affected.";
            } else if (!failsAALarge && failsAA && failsAAALarge && failsAAA) {
              contrastIssueDescription = "Contrast doesn't meet AA for normal text size.";
            } else if (!failsAALarge && !failsAA && !failsAAALarge && failsAAA) {
              contrastIssueDescription = "Contrast doesn't meet AAA for normal text size.";
            } 

            if (Object.values(results).includes("false")) {
              contrastViolations.push({
                layerId: layer.id,
                frame: frame.name,
                layer: layer.name,
                contrastRatio: contrastRatio.toFixed(2),
                issueDescription: contrastIssueDescription,
              });
            }
          }
        }

      // Handle touch target check and generate SVG preview
      if (layer.type === "TEXT") return;
      const width = layer.width;
      const height = layer.height;

      const touchTargetResults = {
        wcagAA: width >= 24 && height >= 24 ? "true" : "false",
        wcagAAA: width >= 44 && height >= 44 ? "true" : "false",
        fluent: width >= 40 && height >= 40 ? "true" : "false",
        material: width >= 48 && height >= 48 ? "true" : "false",
        ios: width >= 44 && height >= 44 ? "true" : "false",
      };

      // Determine the violation description
      let touchIssueDescription = "";

      const failsAA = touchTargetResults.wcagAA === "false";
      const failsAAA = touchTargetResults.wcagAAA === "false";
      const failsFluent = touchTargetResults.fluent === "false";
      const failsMaterial = touchTargetResults.material === "false";
      const failsIOS = touchTargetResults.ios === "false";

      if (failsAA && failsFluent && failsAAA && failsIOS && failsMaterial) {
        touchIssueDescription = "Touch target size is too small across all standards.";
      } else if (!failsAA && failsFluent && failsAAA && failsIOS && failsMaterial) {
        touchIssueDescription = "Touch target size only meet WCAG AA size requirement.";
      } else if (!failsAA && !failsFluent && failsAAA && failsIOS && failsMaterial) {
        touchIssueDescription = "Touch target size doesn't meet WCAG AAA size and iOS requirements.";
      } else if (!failsAA && !failsFluent && !failsAAA && !failsIOS && failsMaterial) {
        touchIssueDescription = "Touch target size doesn't meet Android requirement.";
      } 

      if (Object.values(touchTargetResults).includes("false")) {
        touchTargetViolations.push({
          layerId: layer.id,
          frame: frame.name,
          layer: layer.name,
          width,
          height,
          issueDescription: touchIssueDescription,
        });
      }
    }));
  }

  // Send categorized results to the UI
  figma.ui.postMessage({
    type: "auto-scan-results",
    data: {
      contrastViolations,
      touchTargetViolations,
      contrastLen: contrastViolations.length,
      touchLen: touchTargetViolations.length
    },
  });

  console.log("Contrast Violations:", contrastViolations);
  console.log("Touch Target Violations:", touchTargetViolations);
  // console.log("Text Hierarchy Analysis:", textAnalysis);

  if (contrastViolations.length === 0 && touchTargetViolations.length === 0) {
    figma.ui.postMessage({
      type: "auto-scan-results",
      data: { message: "No violations found!" },
    });
  }
};

const handleContrastCheck = () => {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    console.log('No object selected.'); // Debugging
    emit('contrast-results', { error: 'No object selected.' });
    return;
  }

  const node = selection[0];
  const fillColor = getColors(node);

  let hasImageFill = false;
  if ("fills" in node && Array.isArray(node.fills)) {
    hasImageFill = node.fills.some((fill) => fill.type === "IMAGE");
    console.log('hasImageFill true.');
  }

  if (!fillColor && hasImageFill) {
    figma.notify("Can't detect images!")
    return;
  }

  if (!fillColor) {
    emit('contrast-results', { error: 'Unable to detect color for the selected object!' });
    figma.notify("Unable to detect color for the selected object!")
    return;
  }

  

  const backgroundNode = getBackgroundNode(node);
  const backgroundColor = backgroundNode
    ? getColors(backgroundNode)
    : { r: 255, g: 255, b: 255 };

  if (!backgroundColor) {
    emit('contrast-results', { error: 'Unable to detect background color!' });
    console.log("Unable to detect background color");
    return;
  }

  const contrastRatio = calculateContrastRatio(fillColor, backgroundColor);
  const results = evaluateContrast(contrastRatio);

  // Send the contrast results to the UI without suggestions
  figma.ui.postMessage({
    type: "contrast-results",
    data: {
      contrastRatio: contrastRatio.toFixed(2),
      foregroundColor: fillColor,
      backgroundColor: backgroundColor,
      AA_NormalText: results.AA_NormalText,
      AAA_NormalText: results.AAA_NormalText,
      AA_LargeText: results.AA_LargeText,
      AAA_LargeText: results.AAA_LargeText,
    },
  });

  console.log("Contrast result sent to the UI.");
};

// Separate function to generate suggestions
// const handleGenerateSuggestion = () => {
//   const selection = figma.currentPage.selection;

//   if (selection.length === 0) {
//     console.log('No object selected.'); // Debugging
//     emit('suggestion-results', { error: 'No object selected for suggestions.' });
//     return;
//   }

//   const node = selection[0];
//   const fillColor = getColors(node);

//   if (!fillColor) {
//     emit('suggestion-results', { error: 'Unable to detect color for the selected object!' });
//     return;
//   }

//   const backgroundNode = getBackgroundNode(node);
//   const backgroundColor = backgroundNode
//     ? getColors(backgroundNode)
//     : { r: 255, g: 255, b: 255 };

//   if (!backgroundColor) {
//     emit('contrast-results', { error: 'Unable to detect background color!' });
//     return;
//   }

//   const contrastRatio = calculateContrastRatio(fillColor, backgroundColor);

//   if (contrastRatio > 7) {
//     figma.ui.postMessage({
//       type: "suggestion-results",
//       data: {
//         suggestedColor: "Contrast ratio is sufficient. No color suggestion needed.",
//       },
//     });
//     return;
//   }

//   const data = {
//     foregroundColor: fillColor,
//     backgroundColor: backgroundColor,
//     contrastRatio: contrastRatio.toFixed(2),
//   };

//   fetch('http://127.0.0.1:8000/suggest-color', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify(data),
//   })
//     .then((response) => response.json())
//     .then((suggestions) => {
//       figma.ui.postMessage({
//         type: "suggestion-results",
//         data: {
//           suggestedColor: suggestions.suggestedColor,
//         },
//       });
//       console.log("Suggested color:", suggestions.suggestedColor);
//     })
//     .catch((error) => {
//       console.error('Error sending data to server:', error);
//       figma.ui.postMessage({
//         type: "suggestion-results",
//         data: { error: 'Failed to get color suggestions.' },
//       });
//     });
// };

const handleGenerateSuggestionII = (userDefinedContrast: number): void => {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    console.log("No object selected."); // Debugging
    // emit("suggestion-results-II", { error: "No object selected." });
    figma.notify("No object selected.");
    return;
  }

  const node = selection[0];
  const fillColor = getColors(node);

  if (!fillColor) {
    emit("suggestion-results-II", { error: "Unable to detect color for the selected object!" });
    return;
  }

  const backgroundNode = getBackgroundNode(node);
  const backgroundColor = backgroundNode
    ? getColors(backgroundNode)
    : { r: 255, g: 255, b: 255 };

  if (!backgroundColor) {
    emit("suggestion-results-II", { error: "Unable to detect background color!" });
    return;
  }

  // Calculate the current contrast ratio.
  const contrastRatio = calculateContrastRatio(fillColor, backgroundColor);
  evaluateContrast(contrastRatio);

  let targetRatios: {
    label: string;
    value: number;
}[]

  // Define multiple target contrast ratios
  if (userDefinedContrast == 4.5 || userDefinedContrast == 7.0) {
    targetRatios = [
      { label: "AA", value: 4.5 },
      { label: "AAA", value: 7.0 },
    ];
  } else {
    targetRatios = [
      { label: "AA", value: 4.5 },
      { label: "AAA", value: 7.0 },
      { label: "Custom", value: userDefinedContrast } // Include user-defined contrast ratio
    ];
  }

  let suggestions: { label: string; color: RGB | string; finalRatio: number }[] = [];


  targetRatios.forEach(({ label, value }) => {
    if (contrastRatio < value) {
      const suggestedColorData = suggestWCAGCompliantColor(fillColor, backgroundColor, contrastRatio, value);
      if (suggestedColorData.finalRatio < value) {
        suggestions.push({ label, color: "No Valid Color", finalRatio: suggestedColorData.finalRatio });
      } else {
        suggestions.push({
          label,
          color: suggestedColorData.color,
          finalRatio: suggestedColorData.finalRatio,
        });
      }
    }
  });

  // Send multiple suggestions to the UI
  figma.ui.postMessage({
    type: "suggestion-results-II",
    data: {
      currentContrast: contrastRatio.toFixed(2),
      suggestions: suggestions.length > 0 ? suggestions : "Contrast is sufficient. No color suggestion needed."
    },
  });

  console.log("Suggestions sent to the UI.");
};

const svgPreview = async () => {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    emit('touch-results', { error: 'No object selected.' });
    return;
  }

  const node = selection[0];
  const width = node.width;
  const height = node.height;

  let previewSVG = '';
  try {
    const svgBytes = await node.exportAsync({ format: 'SVG' });
    previewSVG = Array.from(svgBytes)
    .map(byte => String.fromCharCode(byte))
    .join("");
  } catch (error) {
    console.error('Error exporting preview:', error);
    previewSVG = "<p style='color:red;'>Failed to generate preview.</p>";
  }

  const results = {
    wcagAA: width >= 24 && height >= 24 ? "true" : "false",
    wcagAAA: width >= 44 && height >= 44 ? "true" : "false",
    fluent: width >= 44 && height >= 44 ? "true" : "false",
    material: width >= 48 && height >= 48 ? "true" : "false",
    iOS: width >= 44 && height >= 44 ? "true" : "false",
  };

  figma.ui.postMessage({ type: "svg-preview", data: { width, height, previewSVG, wcagAA: results.wcagAA, wcagAAA: results.wcagAAA, fluent: results.fluent, material: results.material, ios: results.iOS } });
  console.log("Touch results sent to UI.")
};

const handleTouchTargetCheck = async () => {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    emit('touch-results', { error: 'No object selected.' });
    return;
  }

  const node = selection[0];

  // if (!isTappableElement(node)) {
  //   emit('touch-results', { error: 'Selected object is not an interactive element.' });
  //   console.error("Selected object is not an interactive element");

  //   return;
  // }

  const width = node.width;
  const height = node.height;

  let previewSVG = '';
  try {
    const svgBytes = await node.exportAsync({ format: 'SVG' });
    previewSVG = Array.from(svgBytes)
    .map(byte => String.fromCharCode(byte))
    .join("");
  } catch (error) {
    console.error('Error exporting preview:', error);
    previewSVG = "<p style='color:red;'>Failed to generate preview.</p>";
  }

  const results = {
    wcagAA: width >= 24 && height >= 24 ? "true" : "false",
    wcagAAA: width >= 44 && height >= 44 ? "true" : "false",
    fluent: width >= 44 && height >= 44 ? "true" : "false",
    material: width >= 48 && height >= 48 ? "true" : "false",
    iOS: width >= 44 && height >= 44 ? "true" : "false",
  };

  figma.ui.postMessage({ type: "touch-results", data: { width, height, previewSVG, wcagAA: results.wcagAA, wcagAAA: results.wcagAAA, fluent: results.fluent, material: results.material, ios: results.iOS } });
  console.log("Touch results sent to UI.")
};

interface VisionResults {
  protanopia: string;
  deuteranopia: string;
  tritanopia: string;
  achromatopsia: string;
}

const handleVisionSimulator = async () => {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    emit('vision-results', { error: 'No object selected.' });
    figma.notify("No object selected.");
    return;
  }

  const node = selection[0];

  try {
    const imageBytes = await node.exportAsync({ format: 'PNG' });
    const base64 = Buffer.from(imageBytes).toString('base64');
    const encodedImage = `data:image/png;base64,${base64}`;

    let previews: VisionResults = {
      protanopia: '',
      deuteranopia: '',
      tritanopia: '',
      achromatopsia: ''
    };

    let simulationContrastResults: { [key in "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia"]: ContrastResult[] } = {
      protanopia: [],
      deuteranopia: [],
      tritanopia: [],
      achromatopsia: []
    };

    // Handling Protanopia simulation
    // Helper function to catch failures and notify
    const handleSimulation = async (
      type: "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia"
    ) => {
      try {
        const result = await handleColorBlindnessForNode(node, type);
        if (!result) {
          throw new Error(`${type} simulation failed: No valid result`);
        }
        previews[type] = result;
        simulationContrastResults[type] = analyzeContrastForNodeAndChildren(node, type);
      } catch (error) {
        console.error(`Error during ${type} simulation:`, error);
        emit('vision-results', { error: `${type} simulation failed.` });
        figma.notify("We're sorry, currently images can't be simulated yet.")
        return false;
      }
      return true;
    };

    // Run simulations for all types
    const simulations: ("protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia")[] = [
      'protanopia',
      'deuteranopia',
      'tritanopia',
      'achromatopsia',
    ];

    for (const simulationType of simulations) {
      const success = await handleSimulation(simulationType);
      if (!success) {
        return;  // Stop further processing if any simulation fails
      }
    }

    // const cvdSuggestions = analyzeColorAccessibility(node);
    console.log(simulationContrastResults)

    figma.ui.postMessage({ 
      type: "vision-results", 
      data: { encodedImage, 
        protanopia: previews.protanopia,
        deuteranopia: previews.deuteranopia,
        tritanopia: previews.tritanopia,
        achromatopsia: previews.achromatopsia,
        // cvdSuggestions, 
        simulationContrastResults,
      } 
    });
    
  } catch (error) {
    console.error('Error exporting preview:', error);
  }
}

// helper functions

const handleColorBlindnessForNode = async (
  node: SceneNode,
  type: "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia"
): Promise<string> => {
  // Clone the node so we don't modify the original.
  const clonedNode = node.clone();
  

  try {
    // Check if the node or its children have image fills
    
    // Try to get the node's fill color
    let color = getColors(node);

    // Check if the node has an image fill.
    let hasImageFill = false;
    if ("fills" in node && Array.isArray(node.fills)) {
      hasImageFill = node.fills.some((fill) => fill.type === "IMAGE");
    }

    // If the node has no solid color, try getting the background rectangle
    if (!color && !hasImageFill && "children" in node) {
      const backgroundNode = getBackgroundElement(node);
      if (backgroundNode) {
        color = getColors(backgroundNode);
      }
    }

    if (!color && hasImageFill) {
      console.error("Images detected");
      // figma.notify("We're sorry, currently images cannot be simulated.")
      return "";
    }
    if (!color && !hasImageFill) {
      console.error("No solid fill color found");
      figma.notify("No solid fill color found")
      clonedNode.remove();
      return "";
    }

    // Process the node and all its children using our simulation algorithm.
    await processNodeAndChildren(clonedNode, type);
    // await processImageFills(clonedNode, type);

    // Export the modified clone as a PNG.
    const imageBytes = await clonedNode.exportAsync({ format: "PNG" });
    const base64 = Buffer.from(imageBytes).toString("base64");
    return `data:image/png;base64,${base64}`;
  } finally {
    // Clean up the cloned node.
    clonedNode.remove();
  }
};

const getBackgroundElement = (node: SceneNode): SceneNode | null => {
  if ("children" in node) {
    for (const child of node.children) {
      if ("fills" in child && Array.isArray(child.fills)) {
        const solidFill = child.fills.find(fill => fill.type === "SOLID");
        if (solidFill) {
          return child; // Found an element with a solid background
        }
      }
    }
  }
  return null;
};

interface ContrastResult {
  nodeName: string;
  simulationType: string;
  contrastOriginal: number;
  contrastSimulated: number;
  difference: number;
  issue: boolean;
}

const pendingSimulations: { [simulationType: string]: (dataURL: string) => void } = {};

async function simulateImageInUI(dataURL: string, simulationType: "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia"): Promise<string> {
  return new Promise((resolve) => {
    pendingSimulations[simulationType] = resolve;
    figma.ui.postMessage({ type: "simulate-image", dataURL, simulationType });
  });
}







/**
 * Recursively analyzes contrast for the node and its children.
 * For each node with a solid fill, calculates the contrast ratio of its color
 * versus the effective background color (if none is provided, it tries to detect one).
 * It then simulates the color for a given type of color blindness (and does the same for the background),
 * calculates the simulated contrast ratio, and stores the results.
 */
const analyzeContrastForNodeAndChildren = (
  node: SceneNode,
  simulationType: "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia",
  parentBackgroundColor?: RGB,
  results: ContrastResult[] = []
): ContrastResult[] => {
  // Determine an effective background color:
  // Use parent's background if available, otherwise try to detect one.
  let effectiveBackground: RGB = parentBackgroundColor
    ? parentBackgroundColor
    : { r: 255, g: 255, b: 255 };

  if (!parentBackgroundColor) {
    const bgNode = getBackgroundElement(node);
    if (bgNode) {
      const bgColor = getColors(bgNode);
      effectiveBackground = bgColor !== null ? bgColor : { r: 255, g: 255, b: 255 };
    }
  }

  // Check if the current node is a container with children.
  const nodeHasChildren = "children" in node && node.children.length > 0;
  // Get the node's fill color (if any).
  const nodeColor = "fills" in node ? getColors(node) : null;

  if (nodeHasChildren && nodeColor) {
    // If the node has children and a solid fill,
    // assume it acts as a background container.
    // Use its fill as the effective background for its children,
    // and skip analyzing this container itself.
    effectiveBackground = nodeColor;
  } else if ("fills" in node && nodeColor) {
    // If the node is not a container with a background (or is a leaf),
    // then analyze its contrast.
    const originalContrast = calculateContrastRatio(nodeColor, effectiveBackground);
    const simulatedElementColor = simulateColorBlindnessForColor(nodeColor, simulationType);
    const simulatedBackground = simulateColorBlindnessForColor(effectiveBackground, simulationType);
    const simulatedContrast = calculateContrastRatio(simulatedElementColor, simulatedBackground);
    const difference = originalContrast - simulatedContrast;
    const issue = simulatedContrast < originalContrast;
    results.push({
      nodeName: node.name,
      simulationType,
      contrastOriginal: originalContrast,
      contrastSimulated: simulatedContrast,
      difference,
      issue,
    });
  }

  // Recursively process children, passing down the effective background.
  if ("children" in node) {
    for (const child of node.children) {
      analyzeContrastForNodeAndChildren(child, simulationType, effectiveBackground, results);
    }
  }

  return results;
};



const isTappableElement = (node: SceneNode): boolean => {
  // Check if it's a button or CTA based on layer name
  if ("name" in node) {
    const lowerName = node.name.toLowerCase();
    if (lowerName.includes("btn") || lowerName.includes("button") || lowerName.includes("cta")) {
      return true;
    }
  }

  // Check if it has interaction (e.g., Click Action in Figma)
  if ("reactions" in node && node.reactions.length > 0) {
    return true;
  }

  // Check if it's a common tappable element type
  if (["FRAME", "COMPONENT", "INSTANCE"].includes(node.type)) {
    return true;
  }

  return false;
};


const processNodeAndChildren = async (
  node: SceneNode,
  simulationType: "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia"
): Promise<void> => {
  if ("fills" in node && node.fills) {
    const color = getColors(node);
    if (color) {
      const simulatedColor = simulateColorBlindnessForColor(color, simulationType);
      applySimulatedColor(node, simulatedColor);
    }
  }

  if ("children" in node) {
    for (const child of node.children) {
      await processNodeAndChildren(child, simulationType);
    }
  }
};

const processImageFills = async (
  node: SceneNode,
  simulationType: "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia"
): Promise<void> => {
  if ("fills" in node && node.fills) {
    const fills = node.fills as Paint[];
    const newFills: Paint[] = [];
    console.log("reach here")

    for (const fill of fills) {
      if (fill.type === "IMAGE" && fill.imageHash) {
        // Export the node as a PNG.
        const imageBytes = await node.exportAsync({ format: "PNG" });
        const base64 = Buffer.from(imageBytes).toString("base64");
        const dataURL = `data:image/png;base64,${base64}`;

        // Send the image data to the UI for simulation.
        const simulatedDataURL: string = await simulateImageInUI(dataURL, simulationType);
        console.log("simulatedDataURL:", simulatedDataURL);
        if (!simulatedDataURL.includes(",")) {
          console.error("Invalid data URL format:", simulatedDataURL);
        }
        console.log("reach here-1")
        console.log(urltoint8array); // Should log a function

        const simulatedBytes = urltoint8array(simulatedDataURL);

        if (!simulatedBytes) {
          console.error("Failed to convert simulatedDataURL to Uint8Array");
          return; // Exit early if there's an error
        }
        console.log("reach here-2")
        const newImage = figma.createImage(simulatedBytes);

        newFills.push({
          ...fill,
          imageHash: newImage.hash,
        });
      } else {
        newFills.push(fill);
      }
    }
    node.fills = newFills;
  }
  if ("children" in node) {
    for (const child of node.children) {
      await processImageFills(child, simulationType);
    }
  }
};

const applySimulatedColor = (
  node: SceneNode,
  color: { r: number; g: number; b: number }
) => {
  if ("fills" in node && node.fills) {
    const fills = node.fills as Paint[];
    const clonedFills = fills.map((fill) => {
      if (fill.type === "SOLID" && fill.color) {
        return {
          ...fill,
          color: {
            r: color.r / 255,
            g: color.g / 255,
            b: color.b / 255,
          },
        };
      }
      return fill;
    });
    node.fills = clonedFills;
  }
};

const urltoint8array = (dataURL: string) => {
  console.log("Data URL inside function:", dataURL);
  const base64 = dataURL.split(',')[1];
  console.log("Base64 part:", base64);

  // Ensure base64 is in the correct format before proceeding with conversion
  if (typeof base64 !== 'string') {
    throw new Error("Expected a base64 encoded string, but got: " + typeof base64);
  }

  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
    const slice = byteCharacters.slice(offset, offset + 1024);
    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    byteArrays.push(new Uint8Array(byteNumbers));
  }

  // Concatenate all the Uint8Arrays into one single Uint8Array
  const totalLength = byteArrays.reduce((sum, arr) => sum + arr.length, 0);
  const finalArray = new Uint8Array(totalLength);

  let offset = 0;
  byteArrays.forEach(arr => {
    finalArray.set(arr, offset);
    offset += arr.length;
  });

  return finalArray;
};


/**
 * Simulates a color vision deficiency on a given color.
 * @param color A color object with r, g, b properties (0â€“255).
 * @param type One of 'protanopia', 'deuteranopia', 'tritanopia', or 'achromatopsia'.
 */
function simulateColorBlindnessForColor(
  color: { r: number; g: number; b: number },
  type: 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia'
): { r: number; g: number; b: number } {
  const srgb: [number, number, number] = [color.r, color.g, color.b];
  let result: [number, number, number];

  switch (type) {
    case 'protanopia':
      result = brettel(srgb, 'protan', 1.0);
      break;
    case 'deuteranopia':
      result = brettel(srgb, 'deutan', 1.0);
      break;
    case 'tritanopia':
      result = brettel(srgb, 'tritan', 1.0);
      break;
    case 'achromatopsia':
      result = monochrome_with_severity(srgb, 1.0);
      break;
    default:
      // Fallback: no simulation.
      result = srgb;
  }
  return {
    r: Math.round(result[0]),
    g: Math.round(result[1]),
    b: Math.round(result[2]),
  };
}

/**
 * Converts a color to its achromatopsic (grayscale) equivalent.
 * @param srgb An array [R, G, B] in sRGB (0â€“255).
 * @param severity Severity of grayscale simulation (1.0 for full achromatopsia).
 */
function monochrome_with_severity(
  srgb: [number, number, number],
  severity: number
): [number, number, number] {
  const z = Math.round(srgb[0] * 0.299 + srgb[1] * 0.587 + srgb[2] * 0.114);
  const r = z * severity + (1 - severity) * srgb[0];
  const g = z * severity + (1 - severity) * srgb[1];
  const b = z * severity + (1 - severity) * srgb[2];
  return [r, g, b];
}

/**
 * The Brettel algorithm.
 * @param srgb An array of 3 numbers [R, G, B] in sRGB (0â€“255).
 * @param t The type: 'protan' | 'deutan' | 'tritan'
 * @param severity Deficiency severity (1.0 for full dichromacy).
 * @returns An array of simulated sRGB values [R, G, B].
 */
function brettel(
  srgb: [number, number, number],
  t: 'protan' | 'deutan' | 'tritan',
  severity: number
): [number, number, number] {
  // Convert sRGB values to linear RGB using our lookup table.
  const rgb: [number, number, number] = [
    sRGB_to_linearRGB_Lookup[srgb[0]],
    sRGB_to_linearRGB_Lookup[srgb[1]],
    sRGB_to_linearRGB_Lookup[srgb[2]],
  ];

  const params = brettel_params[t];
  const { separationPlaneNormal, rgbCvdFromRgb_1, rgbCvdFromRgb_2 } = params;

  // Determine which projection to use based on the separation plane.
  const dotWithSepPlane =
    rgb[0] * separationPlaneNormal[0] +
    rgb[1] * separationPlaneNormal[1] +
    rgb[2] * separationPlaneNormal[2];
  const rgbCvdFromRgb = dotWithSepPlane >= 0 ? rgbCvdFromRgb_1 : rgbCvdFromRgb_2;

  // Transform to the dichromat projection plane.
  const rgb_cvd: [number, number, number] = [
    rgbCvdFromRgb[0] * rgb[0] +
      rgbCvdFromRgb[1] * rgb[1] +
      rgbCvdFromRgb[2] * rgb[2],
    rgbCvdFromRgb[3] * rgb[0] +
      rgbCvdFromRgb[4] * rgb[1] +
      rgbCvdFromRgb[5] * rgb[2],
    rgbCvdFromRgb[6] * rgb[0] +
      rgbCvdFromRgb[7] * rgb[1] +
      rgbCvdFromRgb[8] * rgb[2],
  ];

  // Apply the severity factor (linear interpolation between original and simulated).
  for (let i = 0; i < 3; i++) {
    rgb_cvd[i] = rgb_cvd[i] * severity + rgb[i] * (1 - severity);
  }

  // Convert back to sRGB.
  return [
    sRGB_from_linearRGB(rgb_cvd[0]),
    sRGB_from_linearRGB(rgb_cvd[1]),
    sRGB_from_linearRGB(rgb_cvd[2]),
  ];
}

/**
 * Parameters for the Brettel algorithm.
 * (Values adapted from libDaltonLens; public domain.)
 */
const brettel_params: {
  [key: string]: {
    rgbCvdFromRgb_1: number[];
    rgbCvdFromRgb_2: number[];
    separationPlaneNormal: number[];
  };
} = {
  protan: {
    rgbCvdFromRgb_1: [
      0.14510, 1.20165, -0.34675,
      0.10447, 0.85316, 0.04237,
      0.00429, -0.00603, 1.00174,
    ],
    rgbCvdFromRgb_2: [
      0.14115, 1.16782, -0.30897,
      0.10495, 0.85730, 0.03776,
      0.00431, -0.00586, 1.00155,
    ],
    separationPlaneNormal: [0.00048, 0.00416, -0.00464],
  },
  deutan: {
    rgbCvdFromRgb_1: [
      0.36198, 0.86755, -0.22953,
      0.26099, 0.64512, 0.09389,
     -0.01975, 0.02686, 0.99289,
    ],
    rgbCvdFromRgb_2: [
      0.37009, 0.88540, -0.25549,
      0.25767, 0.63782, 0.10451,
     -0.01950, 0.02741, 0.99209,
    ],
    separationPlaneNormal: [-0.00293, -0.00645, 0.00938],
  },
  tritan: {
    rgbCvdFromRgb_1: [
      1.01354, 0.14268, -0.15622,
     -0.01181, 0.87561, 0.13619,
      0.07707, 0.81208, 0.11085,
    ],
    rgbCvdFromRgb_2: [
      0.93337, 0.19999, -0.13336,
      0.05809, 0.82565, 0.11626,
     -0.37923, 1.13825, 0.24098,
    ],
    separationPlaneNormal: [0.03960, -0.02831, -0.01129],
  },
};

/**
 * Converts an sRGB channel value (0-255) into linear RGB.
 */
function linearRGB_from_sRGB(v: number): number {
  const fv = v / 255;
  if (fv < 0.04045) return fv / 12.92;
  return Math.pow((fv + 0.055) / 1.055, 2.4);
}

/**
 * Converts a linear RGB value (expected in [0,1] range) back to sRGB (0-255).
 */
function sRGB_from_linearRGB(v: number): number {
  if (v <= 0) return 0;
  if (v >= 1) return 255;
  if (v < 0.0031308) return 0.5 + (v * 12.92 * 255);
  return 255 * (Math.pow(v, 1 / 2.4) * 1.055 - 0.055);
}

// Precompute a lookup table for sRGB â†’ linearRGB conversion for 0â€“255 values.
const sRGB_to_linearRGB_Lookup: number[] = new Array(256);
for (let i = 0; i < 256; i++) {
  sRGB_to_linearRGB_Lookup[i] = linearRGB_from_sRGB(i);
}


const analyzeTextHierarchy = async (
  textLayers: { id: string; text: string }[]
): Promise<{ id: string; type: string; level?: number }[]> => {
  const response = await fetch('http://localhost:3000/api/text-hierarchy', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
      },
      body: JSON.stringify({ textLayers }),
  });

  if (!response.ok) {
      throw new Error('Failed to analyze text hierarchy');
  }

  const data = await response.json();
  return data; // Expected structure: [{ id: 'layer-id', type: 'heading', level: 1 }]
};


const getTextLayers = (): { id: string; text: string }[] => {
  const textLayers: { id: string; text: string }[] = [];

  const processNode = (node: SceneNode): void => {
      if (node.type === 'TEXT') {
          textLayers.push({ id: node.id, text: node.characters });
      }

      if ('children' in node) {
          for (const child of node.children) {
              processNode(child);
          }
      }
  };

  if (figma.currentPage.selection.length === 0) {
      figma.currentPage.children.forEach(processNode);
  } else {
      figma.currentPage.selection.forEach(processNode);
  }
  
  return textLayers;
};


const getColors = (node: SceneNode) => {
  if ('fills' in node) {
    const fills = node.fills as Paint[];
    const solidFill = fills.find((fill) => fill.type === 'SOLID') as SolidPaint | undefined;
    if (solidFill) {
      return convertToRGB(solidFill.color);
    }
  }
  return null; // Default to white if no solid color
};


const convertToRGB = (color: RGB) => ({
  r: Math.round(color.r * 255),
  g: Math.round(color.g * 255),
  b: Math.round(color.b * 255),
});

// const getBackgroundNode = (node: SceneNode): SceneNode | null => {
//   const allNodes = figma.currentPage.findAll();

//   const backgroundNodes = allNodes.filter((n) => {
//     if (
//       n.absoluteBoundingBox &&
//       node.absoluteBoundingBox &&
//       n !== node && // Exclude the selected node itself
//       n.absoluteBoundingBox.x <= node.absoluteBoundingBox.x &&
//       n.absoluteBoundingBox.y <= node.absoluteBoundingBox.y &&
//       n.absoluteBoundingBox.x + n.absoluteBoundingBox.width >= node.absoluteBoundingBox.x + node.absoluteBoundingBox.width &&
//       n.absoluteBoundingBox.y + n.absoluteBoundingBox.height >= node.absoluteBoundingBox.y + node.absoluteBoundingBox.height &&
//       n.visible // Only include visible nodes
//     ) {
//       return true;
//     }
//     return false;
//   });

//   // Return the topmost background node (last in visual order)
//   return backgroundNodes.length > 0 ? backgroundNodes[backgroundNodes.length - 1] : null;
// };

const getBackgroundNode = (node: SceneNode): SceneNode | null => {
  const parent = node.parent;
  if (!parent || !("children" in parent)) return null; // Ensure the parent is valid

  const siblings = parent.children;
  const nodeIndex = siblings.indexOf(node);

  // Step 1: Check sibling layers **below** the text
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const potentialBg = siblings[i];

    if (
      potentialBg.visible &&
      "fills" in potentialBg &&
      potentialBg.absoluteBoundingBox &&
      node.absoluteBoundingBox
    ) {
      const fills = potentialBg.fills as Paint[];
      const hasSolidFill = fills.some(fill => fill.type === "SOLID");

      // Ensure it visually covers the selected node
      const coversNode =
        potentialBg.absoluteBoundingBox.x <= node.absoluteBoundingBox.x &&
        potentialBg.absoluteBoundingBox.y <= node.absoluteBoundingBox.y &&
        potentialBg.absoluteBoundingBox.x + potentialBg.absoluteBoundingBox.width >= node.absoluteBoundingBox.x + node.absoluteBoundingBox.width &&
        potentialBg.absoluteBoundingBox.y + potentialBg.absoluteBoundingBox.height >= node.absoluteBoundingBox.y + node.absoluteBoundingBox.height;

      if (hasSolidFill && coversNode) {
        return potentialBg; // Found a valid background layer
      }
    }
  }

  let ancestor: BaseNode | null = parent;
while (ancestor && ancestor.type !== "PAGE") {
  if ("fills" in ancestor) {
    const fills = ancestor.fills as Paint[];
    const hasSolidFill = fills.some(fill => fill.type === "SOLID");

    if (hasSolidFill) {
      return ancestor as SceneNode; // âœ… Ensure it's a SceneNode
    }
  }

  // âœ… Check if ancestor is a valid SceneNode before accessing `parent.children`
  if (ancestor.parent && "children" in ancestor.parent) {
    const parentSiblings = ancestor.parent.children;
    
    // âœ… Type assertion: Ensure ancestor is a SceneNode
    if (ancestor.type !== "DOCUMENT") {
      const parentIndex = parentSiblings.indexOf(ancestor as SceneNode);

      for (let i = parentIndex - 1; i >= 0; i--) {
        const potentialBg = parentSiblings[i];

        if (
          potentialBg.visible &&
          "fills" in potentialBg &&
          potentialBg.absoluteBoundingBox &&
          node.absoluteBoundingBox
        ) {
          const fills = potentialBg.fills as Paint[];
          const hasSolidFill = fills.some(fill => fill.type === "SOLID");

          const coversNode =
            potentialBg.absoluteBoundingBox.x <= node.absoluteBoundingBox.x &&
            potentialBg.absoluteBoundingBox.y <= node.absoluteBoundingBox.y &&
            potentialBg.absoluteBoundingBox.x + potentialBg.absoluteBoundingBox.width >= node.absoluteBoundingBox.x + node.absoluteBoundingBox.width &&
            potentialBg.absoluteBoundingBox.y + potentialBg.absoluteBoundingBox.height >= node.absoluteBoundingBox.y + node.absoluteBoundingBox.height;

          if (hasSolidFill && coversNode) {
            return potentialBg; // âœ… Found background (e.g., Rectangle)
          }
        }
      }
    }
  }

  ancestor = ancestor.parent;
}


  return null; // No valid background found
};




const calculateContrastRatio = (
  color1: { r: number; g: number; b: number }, 
  color2: { r: number; g: number; b: number }) => {
  const calculateLuminance = (color: { r: number; g: number; b: number }) => {
    const toLinear = (value: number) =>
      value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);

    const r = toLinear(color.r / 255);
    const g = toLinear(color.g / 255);
    const b = toLinear(color.b / 255);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const lum1 = calculateLuminance(color1);
  const lum2 = calculateLuminance(color2);
  return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
};

const evaluateContrast = (contrastRatio: number) => ({
  AA_NormalText: contrastRatio >= 4.5 ? "true" : "false",
  AA_LargeText: contrastRatio >= 3.0 ? "true" : "false",
  AAA_NormalText: contrastRatio >= 7.0 ? "true" : "false",
  AAA_LargeText: contrastRatio >= 4.5 ? "true" : "false",
});

// Convert RGB to HSL.
// Returns a tuple: [hue (0-360), saturation (0-1), lightness (0-1)]
const rgbToHsl = ({ r, g, b }: RGB ): [number, number, number] => {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  const l = (max + min) / 2;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h *= 60;
  }
  return [h, s, l];
};

// Helper function for HSL to RGB conversion.
const hueToRgb = (p: number, q: number, t: number): number => {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
};

// Convert HSL back to RGB.
const hslToRgb = (h: number, s: number, l: number): RGB => {
  h = h % 360;
  const hNorm = h / 360;
  let r: number, g: number, b: number;

  if (s === 0) {
    // Achromatic (gray)
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, hNorm + 1 / 3);
    g = hueToRgb(p, q, hNorm);
    b = hueToRgb(p, q, hNorm - 1 / 3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

// Adjust the lightness of a color by a given factor.
// Factor > 1 increases lightness; factor < 1 decreases lightness.
const adjustLightness = (color: RGB, factor: number): RGB => {
  const [h, s, l] = rgbToHsl(color);
  // // Multiply the lightness by the factor and clamp between 0 and 1.
  const newL = Math.min(1, Math.max(0, l * factor));
  return hslToRgb(h, s, newL);
};

// --- Gradient Search to Suggest WCAG-Compliant Color --- //

/**
 * Uses a gradient search starting from the original foreground color (fg)
 * to suggest a new color that meets the target contrast ratio with the background (bg).
 *
 * @param fg - Original foreground color.
 * @param bg - Background color.
 * @param targetRatio - Desired WCAG contrast ratio.
 * @param maxIterations - Maximum iterations for the search.
 * @param tolerance - Tolerance for how close the ratio should be to the target.
 * @returns The suggested new foreground color.
 */
const colorSearch = (
  fg: RGB,
  bg: RGB,
  currentRatio: number,
  targetRatio: number,
  maxIterations = 100,
  factor = 0
): RGB => {
  let currentFG = fg;
  // const [, , fgL] = rgbToHsl(fg);
  const [, , bgL] = rgbToHsl(bg);
  for (let i = 0; i < maxIterations; i++) {
    const currentRatio = calculateContrastRatio(currentFG, bg);
    console.log(currentRatio);
    if (currentRatio >= targetRatio) {
      break;
    }
    const [ , , currentFG_L ] = rgbToHsl(currentFG);


    if (currentFG_L > bgL) {
      factor = 1 + Math.min(Math.max((targetRatio - currentRatio) * 0.1, 0.01), 0.2);
    }

    if (currentFG_L < bgL) {
      factor = 1 - Math.min(Math.max((targetRatio - currentRatio) * 0.1, 0.01), 0.2);
    }
    // Decide adjustment: if current contrast is too low, brighten the fg;
    // if it's too high (rare, but could happen), darken it.
    // const adjustmentFactor = 1 + Math.min(Math.max((currentRatio - targetRatio) * 0.1, 0.005), 0.2);
    currentFG = adjustLightness(currentFG, factor);
  }
  return currentFG;
};

/**
 * Suggests a new WCAG-compliant foreground color based on the original foreground (fg)
 * and the background (bg). This function uses the original foreground color as a baseline.
 *
 * @param fg - Original foreground color.
 * @param bg - Background color.
 * @param targetRatio - Desired contrast ratio (e.g., 7.0 for WCAG AAA).
 * @returns An object with the suggested color and its final contrast ratio.
 */
const suggestWCAGCompliantColor = (
  fg: RGB,
  bg: RGB,
  currentRatio: number,
  targetRatio: number
): { color: RGB; finalRatio: number } => {
  // Use the original color as the starting point.
  const refinedColor = colorSearch(fg, bg, currentRatio, targetRatio);
  const finalRatio = calculateContrastRatio(refinedColor, bg);
  return { color: refinedColor, finalRatio };
};


function clone(val: readonly Paint[] | typeof figma.mixed) {
  return JSON.parse(JSON.stringify(val))
}
