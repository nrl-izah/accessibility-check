import { showUI, on, emit } from '@create-figma-plugin/utilities';
import { Buffer } from 'buffer';

export default function () {
  showUI({
    height: 600,
    width: 400
  })

  // Listen for messages
  on('start-color-contrast', () => {
    figma.on('selectionchange', handleSelectionChange);
    handleSelectionChange(); // Initial check
  });

  on('start-touch-target', () => {
    figma.on('selectionchange', handleTouchTargetCheck);
    handleTouchTargetCheck(); // Initial check
  });

  on('start-vision-simulator', () => {
    figma.on('selectionchange', handleVisionSimulator);
    handleVisionSimulator(); // Initial check
  });

  figma.on('selectionchange', () => {
    console.log("Selection changed:", figma.currentPage.selection);
    handleSelectionChange(); // Call the function for color contrast
    handleTouchTargetCheck(); // Call the function for touch target check
    handleVisionSimulator();
  });


}
const handleSelectionChange = () => {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    console.log('No object selected.'); // Debugging
    emit('contrast-results', { error: 'No object selected.' });
    return;
  }

  const node = selection[0];
  const fillColor = getColors(node);

  if (!fillColor) {
    emit('contrast-results', { error: 'Unable to detect color for the selected object!' });
    return;
  }

  const backgroundNode = getBackgroundNode(node);
  const backgroundColor = backgroundNode
    ? getColors(backgroundNode)
    : { r: 255, g: 255, b: 255 };

  if (!backgroundColor) {
    emit('contrast-results', { error: 'Unable to detect background color!' });
    return;
  }

  const contrastRatio = calculateContrastRatio(fillColor, backgroundColor);
  const results = evaluateContrast(contrastRatio);

  // Send the results to the UI
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
    }
});
};

const handleTouchTargetCheck = async () => {
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
    fluent: width >= 40 && height >= 40 ? "true" : "false",
    material: width >= 48 && height >= 48 ? "true" : "false",
    iOS: width >= 44 && height >= 44 ? "true" : "false",
  };

  figma.ui.postMessage({ type: "touch-results", data: { width, height, previewSVG, wcagAA: results.wcagAA, wcagAAA: results.wcagAAA, fluent: results.fluent, material: results.material, ios: results.iOS } });
};


const handleVisionSimulator = async () => {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    emit('vision-results', { error: 'No object selected.' });
    return;
  }

  const node = selection[0];

  try {
    const imageBytes = await node.exportAsync({ format: 'PNG' });
    const base64 = Buffer.from(imageBytes).toString('base64');
    const encodedImage = `data:image/png;base64,${base64}`;

    const previews = {
      protanopia: await handleColorBlindnessForNode(node, 'protanopia'),
      deuteranopia: await handleColorBlindnessForNode(node, 'deuteranopia'),
      tritanopia: await handleColorBlindnessForNode(node, 'tritanopia'),
      achromatopsia: await handleColorBlindnessForNode(node, 'achromatopsia'),
    };

    figma.ui.postMessage({ 
      type: "vision-results", 
      data: { encodedImage, 
        protanopia: previews.protanopia,
        deuteranopia: previews.deuteranopia,
        tritanopia: previews.tritanopia,
        achromatopsia: previews.achromatopsia, } 
    });
    
  } catch (error) {
    console.error('Error exporting preview:', error);
  }
}

// helper functions

const handleColorBlindnessForNode = async (node: SceneNode, type: string): Promise<string> => {
  // Clone the node
  const clonedNode = node.clone();

  try {
    // Step 1: Get the original color from the node
    const color = getColors(node); // Extract original color
    if (!color) {
      console.error('No solid fill color found');
      clonedNode.remove(); // Cleanup cloned node
      return '';
    }

    // Step 2: Get the transformation matrix for the type of color blindness
    const transformationMatrices: { [key: string]: number[][] } = {
      protanopia: [
        [0.567, 0.433, 0.000],
        [0.558, 0.442, 0.000],
        [0.000, 0.242, 0.758],
      ],
      deuteranopia: [
        [0.625, 0.375, 0.000],
        [0.700, 0.300, 0.000],
        [0.000, 0.300, 0.700],
      ],
      tritanopia: [
        [0.950, 0.050, 0.000],
        [0.000, 0.433, 0.567],
        [0.000, 0.475, 0.525],
      ],
      achromatopsia: [
        [0.299, 0.587, 0.114],
        [0.299, 0.587, 0.114],
        [0.299, 0.587, 0.114],
      ],
    };

    const matrix = transformationMatrices[type];
    if (!matrix) {
      clonedNode.remove(); // Cleanup cloned node
      throw new Error('Invalid color blindness type');
    }

    // Recursively process all children nodes
    await processNodeAndChildren(clonedNode, matrix);

    // Export the modified cloned node as an image
    const imageBytes = await clonedNode.exportAsync({ format: 'PNG' });
    const base64 = Buffer.from(imageBytes).toString('base64');

    return `data:image/png;base64,${base64}`;
  } finally {
    // Remove the cloned node to avoid canvas clutter
    clonedNode.remove();
  }
};

const applySimulatedColorRecursively = (node: SceneNode, color: { r: number; g: number; b: number }) => {
  if (node.type === 'TEXT' && 'fills' in node) {
    try {
      const fills = node.fills as Paint[];

      // Clone and modify text fills only if they are SOLID
      const clonedFills = fills.map(fill => {
        if (fill.type === 'SOLID') {
          return {
            ...fill,
            color: {
              r: color.r / 255,
              g: color.g / 255,
              b: color.b / 255,
            },
          };
        }
        return fill; // Preserve non-solid fills
      });

      node.fills = clonedFills; // Apply updated fills to TEXT node
    } catch (error) {
      console.error(`Error updating TEXT node fills`);
    }
  } else if ('fills' in node && node.fills) {
    // Handle SHAPE nodes (e.g., RECTANGLE, ELLIPSE)
    const fills = node.fills as Paint[];

    const clonedFills = fills.map(fill => {
      if (fill.type === 'SOLID') {
        return {
          ...fill,
          color: {
            r: color.r / 255,
            g: color.g / 255,
            b: color.b / 255,
          },
        };
      }
      return fill; // Preserve non-solid fills
    });

    node.fills = clonedFills;
  }

  // Recursively process child nodes if the node is a container
  if ('children' in node) {
    node.children.forEach(child => applySimulatedColorRecursively(child, color));
  }
};



const processNodeAndChildren = async (node: SceneNode, matrix: number[][]): Promise<void> => {
  if ('fills' in node) {
    // Extract and modify the color of the node itself
    const color = getColors(node);
    if (color) {
      const simulatedColor = simulateColorBlindnessForColor(color, matrix);
      applySimulatedColor(node, simulatedColor);
    }
  }

  // Recursively process children if the node has children (like in groups)
  if ('children' in node) {
    for (const child of node.children) {
      await processNodeAndChildren(child, matrix);
    }
  }
};

const applySimulatedColor = (node: SceneNode, color: { r: number; g: number; b: number }) => {
  if ('fills' in node) {
    const fills = node.fills as Paint[];

    // Clone the fills manually
    const clonedFills = fills.map(fill => {
      if (fill.type === 'SOLID') {
        return {
          ...fill,
          color: {
            r: color.r / 255,
            g: color.g / 255,
            b: color.b / 255,
          },
        };
      }
      return fill; // Keep other fill types unchanged
    });

    node.fills = clonedFills; // Apply the cloned fills back to the node
  }
};


const simulateColorBlindnessForColor = (color: { r: number, g: number, b: number }, matrix: number[][]) => {
  const r = color.r;
  const g = color.g;
  const b = color.b;

  const transformedR = Math.min(255, r * matrix[0][0] + g * matrix[0][1] + b * matrix[0][2]);
  const transformedG = Math.min(255, r * matrix[1][0] + g * matrix[1][1] + b * matrix[1][2]);
  const transformedB = Math.min(255, r * matrix[2][0] + g * matrix[2][1] + b * matrix[2][2]);

  return {
    r: transformedR,
    g: transformedG,
    b: transformedB,
  };
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

const getBackgroundNode = (node: SceneNode): SceneNode | null => {
  const allNodes = figma.currentPage.findAll();

  const backgroundNodes = allNodes.filter((n) => {
    if (
      n.absoluteBoundingBox &&
      node.absoluteBoundingBox &&
      n !== node && // Exclude the selected node itself
      n.absoluteBoundingBox.x <= node.absoluteBoundingBox.x &&
      n.absoluteBoundingBox.y <= node.absoluteBoundingBox.y &&
      n.absoluteBoundingBox.x + n.absoluteBoundingBox.width >= node.absoluteBoundingBox.x + node.absoluteBoundingBox.width &&
      n.absoluteBoundingBox.y + n.absoluteBoundingBox.height >= node.absoluteBoundingBox.y + node.absoluteBoundingBox.height &&
      n.visible // Only include visible nodes
    ) {
      return true;
    }
    return false;
  });

  // Return the topmost background node (last in visual order)
  return backgroundNodes.length > 0 ? backgroundNodes[backgroundNodes.length - 1] : null;
};

const calculateContrastRatio = (color1: { r: number; g: number; b: number }, color2: { r: number; g: number; b: number }) => {
  const calculateLuminance = (color: { r: number; g: number; b: number }) => {
    const toLinear = (value: number) =>
      value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);

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


