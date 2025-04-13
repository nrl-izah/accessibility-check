import { render } from '@create-figma-plugin/ui'
import { h } from 'preact'
import { useState } from 'preact/hooks'
import html2canvas from 'html2canvas'
import Popover from "./component/popover"
import SettingsPage from "./page/setting"

import '!./output.css'

function Plugin () {
  
  type SuggestedColor = {
    label: string;  // "WCAG AA", "WCAG AAA", "Custom"
    color: RGB;
    finalRatio: number;
  };

  interface SuggestResultsII {
    suggestions: SuggestedColor[] | string;
  }

  interface ContrastResult {
    nodeName: string;
    simulationType: string;
    contrastOriginal: number;
    contrastSimulated: number;
    difference: number;
    issue: boolean;
  }
  
  // Instead of explicitly listing each type, make it dynamic
  interface SimulationContrastResults {
    [key: string]: ContrastResult[]; // e.g., "protanopia": [{...}], "deuteranopia": [{...}]
  }


  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState("homePage");
  const [previousPage, setPreviousPage] = useState<string | null>(null);

  const [autoScanResults, setAutoScanResults] = useState<{
    contrastViolations: {
      layerId: string;
      frame: string;
      layer: string;
      contrastRatio: string;
      issueDescription: string;
      violationId: string;
    }[];
    touchTargetViolations: {
      layerId: string;
      frame: string;
      layer: string;
      width: number;
      height: number;
      issueDescription: string;
      violationId: string;
    }[];
    contrastLen: number;
    touchLen: number; 
  }>({
    contrastViolations: [],
    touchTargetViolations: [],
    contrastLen: 0,
    touchLen: 0,
  });
  
  const [contrastResults, setContrastResults] = useState({
    contrastRatio: "0:0",
    foreColor: { r: 255, g: 255, b: 255 },
    backColor: { r: 255, g: 255, b: 255 },
    AA_NormalText: "-",
    AAA_NormalText: "-",
    AA_LargeText: "-",
    AAA_LargeText: "-",
  });
  const [suggestedResults, setSuggestResults] = useState({
    suggestedColor: "-"
  });

  const [suggestedResultsII, setSuggestResultsII] = useState<SuggestResultsII>({
    suggestions: "-",
  });
  
  const [touchResults, setTouchResults] = useState({
    previewContent: `<p class="placeholder">No preview available</p>`,
    width: 0,
    height: 0,
    dimensions: "0px x 0px",
    wcagAA: "-",
    wcagAAA: "-",
    iosStatus: "-",
    materialStatus: "-",
    fluentStatus: "-",
  });
  const [visionPreviews, setVisionPreviews] = useState<{
    original: string | null;
    protanopia: string | null;
    deuteranopia: string | null;
    tritanopia: string | null;
    achromatopsia: string | null;
  } | null>(null);
  const [currentVisionType, setCurrentVisionType] = useState<'original' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia'>('original');

  const [isAboutVisible, setIsAboutVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isColorBoxClicked, setColorBoxClicked] = useState(false);
  const [selectedColor, setSelectedColor] = useState<RGB | null>(null);
  const [visionSuggestions, setVisionSuggestions] = useState<Record<string, string[]>>({});
  const [isDismissing, setIsDismissing] = useState(false);
  const [dismissedViolations, setDismissedViolations] = useState<Set<string>>(new Set());


  const handleColorApply = (color: RGB) => {
  
    parent.postMessage(
      { pluginMessage: { type: "apply-color", color: color } },
      "*"
    );
    setColorBoxClicked(false);

  };

  const handleColorApplyAll = (color: RGB, original: {r: number, g: number, b: number}) => {
  
    parent.postMessage(
      { pluginMessage: { type: "apply-color-all", color: color, original: original} },
      "*"
    );
    setColorBoxClicked(false);

  };

  const handleColorBoxClick = (color: RGB) => {
    setSelectedColor(color);
    setColorBoxClicked(true);
  };

  const toggleAboutSection = () => {
    setIsAboutVisible(prevState => !prevState);
  };

  const handleLayerSelection = (layerId: string) => {
    parent.postMessage({ pluginMessage: { type: "select-layer", id: layerId } }, "*");
  };

  const suggestColor = () => {
    setIsScanning(true);
    parent.postMessage({ pluginMessage: { type: "start-suggest-color" } }, "*");
    setTimeout(() => setIsScanning(false), 3000);
  }

  const suggestColorII = () => {
    // setIsScanning(true);
    parent.postMessage({ pluginMessage: { type: "start-suggest-color-II" } }, "*");
    // setTimeout(() => setIsScanning(false), 3000);
  }

  const onDismiss = (violationId: string) => {
    setDismissedViolations((prev) => new Set(prev).add(violationId));
  };

  const handleDismiss = (violationId: string) => {
    // Send the dismissal message to the plugin main code
    setDismissedViolations((prev) => new Set(prev).add(violationId));
    setTimeout(() => {
      onDismiss(violationId);
    }, 300);
    parent.postMessage({ pluginMessage: { type: "dismiss-violation", id: violationId } }, "*");
  };
  

  const pageTitles: { [key: string]: string } = {
    homePage: "Accessibility Evaluator",
    colorContrastPage: "Color Contrast",
    touchTargetPage: "Touch Target",
    visionSimulatorPage: "Colorblindness Simulator",
    autoScanPage: "Auto Scan",
    aboutPage: "About",
    settingPage: "Setting",
  };

  const navigateTo = (page: string, data: any = null) => {
    setCurrentPage(page);
    if (page === "colorContrastPage") {
      parent.postMessage({ pluginMessage: { type: "start-color-contrast" } }, "*");
      setIsScanning(true);
      setTimeout(() => setIsScanning(false), 3000);
    } else if (page === "touchTargetPage") {
      parent.postMessage({ pluginMessage: { type: "start-touch-target" } }, "*");
    } else if (page === "visionSimulatorPage") {
      parent.postMessage({ pluginMessage: { type: "start-vision-simulator" } }, "*");
    } else if (page === "autoScanPage") {
      setIsScanning(true);
      parent.postMessage({ pluginMessage: { type: "start-auto-scan" } }, "*");
      setTimeout(() => setIsScanning(false), 3000);
    } else if (page === "settingPage") {
      parent.postMessage({ pluginMessage: { type: "start-setting" } }, "*");
    }
  };

  const handleBackButton = () => {
    if (currentPage === "colorContrastPage") {
      parent.postMessage({ pluginMessage: { type: "stop-color-contrast" } }, "*");
      setContrastResults({
        contrastRatio: "0:0",
        foreColor: { r: 255, g: 255, b: 255 },
        backColor: { r: 255, g: 255, b: 255 },
        AA_NormalText: "-",
        AAA_NormalText: "-",
        AA_LargeText: "-",
        AAA_LargeText: "-",
      });
      setSuggestResultsII({
        suggestions: "-",
      });
      setColorBoxClicked(false);
    } else if (currentPage === "touchTargetPage") {
      parent.postMessage({ pluginMessage: { type: "stop-touch-check" } }, "*");
      setTouchResults({
        previewContent: `<p class="placeholder">No preview available</p>`,
        width: 0,
        height: 0,
        dimensions: "0px Ã— 0px",
        wcagAA: "-",
        wcagAAA: "-",
        iosStatus: "-",
        materialStatus: "-",
        fluentStatus: "-",
      });
    } else if (currentPage === "visionSimulatorPage") {
      parent.postMessage({ pluginMessage: { type: "stop-vision-simulator" } }, "*");
      setVisionPreviews({
        original: null,
        protanopia: null,
        deuteranopia: null,
        tritanopia: null,
        achromatopsia: null,
      });
    } else if (currentPage === "autoScanPage") {
      // setAutoScanResults([]);
    } 
    if (previousPage === "autoScanPage") {
      setCurrentPage("autoScanPage");
      setPreviousPage(null); // Reset previous page after returning
    } else {
      setCurrentPage("homePage");
    }
  };

  const handleDetailsContrast = (violation: typeof autoScanResults.contrastViolations[0]) => {
    setPreviousPage(currentPage);
    navigateTo("colorContrastPage");
    handleLayerSelection(violation.layerId);
    suggestColorII();
  };

  const handleDetailsTouch = (violation: typeof autoScanResults.touchTargetViolations[0]) => {
    setPreviousPage(currentPage);
    navigateTo("touchTargetPage");
    handleLayerSelection(violation.layerId);
  };

  const captureReport = async (id: string) => {
    const evaluationElement = document.getElementById(id);
    if (!evaluationElement) {
      console.error("Element not found");
      return;
    }
  
    const canvas = await html2canvas(evaluationElement, { 
      backgroundColor: "#2c2c2c", 
      scale: 2 
    });
  
    canvas.toBlob(async (blob) => {
      if (!blob) return;
  
      const uint8Array = new Uint8Array(await blob.arrayBuffer());
  
      // Send image data to the backend
      parent.postMessage({ pluginMessage: { type: "save-report", image: uint8Array } }, "*");
    }, "image/png");
  };



  // Directly use the RGB values in your styles
  const { r: foreR, g: foreG, b: foreB } = contrastResults.foreColor;
  const { r: backR, g: backG, b: backB } = contrastResults.backColor;

  window.onmessage = async (event) => {
    const msg = event.data.pluginMessage;
    if (msg.type === "contrast-results") {
      const { contrastRatio, foregroundColor, backgroundColor, AA_NormalText, AAA_NormalText, AA_LargeText, AAA_LargeText, suggestedColor } = msg.data;
      setContrastResults({
        contrastRatio: `${contrastRatio}:1`,
        foreColor: foregroundColor,
        backColor: backgroundColor,
        AA_NormalText: AA_NormalText,
        AAA_NormalText: AAA_NormalText,
        AA_LargeText: AA_LargeText,
        AAA_LargeText: AAA_LargeText,
      });
    } else if (msg.type === "touch-results") {
      const { width, height, previewSVG, wcagAA, wcagAAA, fluent, material, ios, error } = msg.data;

      setTouchResults({
        previewContent: previewSVG ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" style="width:100%; height:100%;">${previewSVG}</svg>` : `<p style="color:red;">Failed to generate preview.</p>`,
        width: width,
        height: height,
        dimensions: `${width}px x ${height}px`,
        wcagAA: wcagAA,
        wcagAAA: wcagAAA,
        iosStatus: ios,
        materialStatus: material,
        fluentStatus: fluent,
      });
    } else if (msg.type === "vision-results") {
      const { encodedImage, protanopia, deuteranopia, tritanopia, achromatopsia, simulationContrastResults } = msg.data as {
        encodedImage: string;
        protanopia: string;
        deuteranopia: string;
        tritanopia: string;
        achromatopsia: string;
        simulationContrastResults: SimulationContrastResults;
      };

      setVisionPreviews({
        original: encodedImage,
        protanopia: protanopia,
        deuteranopia: deuteranopia,
        tritanopia: tritanopia,
        achromatopsia:  achromatopsia,
      });
      setCurrentVisionType('original');

      if (simulationContrastResults) {
        const structuredIssues: Record<string, string[]> = {};

        Object.entries(simulationContrastResults).forEach(([type, results]) => {
          const issues = (results as ContrastResult[])
            .filter(({ contrastOriginal, contrastSimulated }) => 
              (contrastOriginal < 7 && contrastSimulated < contrastOriginal) ||
              (contrastOriginal >= 7 && contrastSimulated < 7)
            )
            .map(({ nodeName }) => nodeName);
    
          if (issues.length > 0) {
            structuredIssues[type] = issues;
          }
        });

        setVisionSuggestions(structuredIssues);
      }
    } else if (msg.type === "auto-scan-results") {
      console.log('Contrast results received:', msg.data);
      const { contrastViolations, touchTargetViolations, contrastLen, touchLen } = event.data.pluginMessage.data;

      setAutoScanResults({
        contrastViolations: contrastViolations || [],
        touchTargetViolations: touchTargetViolations || [],
        contrastLen, 
        touchLen,
      });
      setIsScanning(false);
    } else if (msg.type === "suggestion-results") {
      console.log('Suggestion results received:', msg.data);
      const { suggestedColor } = msg.data;

      setSuggestResults({
        suggestedColor: suggestedColor,
      });
      setIsScanning(false);
    } else if (msg.type === "suggestion-results-II") {
      console.log("Suggestion results received-II:", msg.data);
      const { suggestions  } = msg.data;

      setSuggestResultsII({
        suggestions: Array.isArray(suggestions) && suggestions.length > 0 ? suggestions : "Contrast is sufficient. No color suggestion needed.",
      });

      setIsScanning(false);
    }
    else if (msg.type === "reset-suggestion") {
      setSuggestResultsII({
        suggestions: "-",
      });
      setColorBoxClicked(false);

    }
    else if (msg.type === "simulate-image") {
        const { dataURL, simulationType } = msg;
        const simulatedDataURL = await simulateImage(dataURL, simulationType);
        // Post back the simulated image data URL.
        parent.postMessage(
          { pluginMessage: { type: "simulated-image", simulationType, dataURL: simulatedDataURL } },
          "*"
        );
      }
  };

 

  return (
    <body>
      <header>
        <button onClick={handleBackButton} disabled={currentPage === "homePage"}>
          {/* <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 512 512">
            <path
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="48"
              d="M244 400L100 256l144-144M120 256h292"
            />
          </svg> */}
          Back
        </button>
        <h1>{pageTitles[currentPage]}</h1>
      </header>

      <main>
        {currentPage === "homePage" && (
          <div className="home-pg">
            <div className="main-btn">
              <button className="feature border-grad" onClick={() => navigateTo("autoScanPage")}>Auto Scan</button>
            </div>
            
            <h1>Separate Scan</h1>
            <div className="main-btn">
              <button className="feature border-grad" onClick={() => navigateTo("colorContrastPage")}>Color Contrast</button>
              <button className="feature border-grad" onClick={() => navigateTo("touchTargetPage")}>Touch Target</button>
              <button className="feature border-grad" onClick={() => navigateTo("visionSimulatorPage")}>Colorblindness Simulator</button>
            </div>

            <h1>All You Need To Know</h1>
            <div className="main-btn">
              <button className="feature border-grad" onClick={() => navigateTo("aboutPage")}>About</button>
              <button className="feature border-grad" onClick={() => navigateTo("settingPage")}>Setting</button>
            </div>
            
            
          </div>
        )}

        {currentPage === "autoScanPage" && (
          <div>
            <div className="row">
              <div className="label">
                <p className="instruction text-sm">Violation scan on all pages.</p>
              </div>
              <div className="result text-sm" style={{margin: "10px 0px",}}>
                <div className="svg-container" tabIndex={0} role="button" onClick={() => navigateTo("autoScanPage")}>
                  <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="25" height="25" viewBox="0,0,256,256">
                    <title>Refresh page</title>
                    <g fill="rgba(230,210,164,1)" fill-rule="nonzero" stroke="none" stroke-width="1" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0" font-family="none" font-weight="none" font-size="none" text-anchor="end" style="mix-blend-mode: normal"><g transform="scale(8,8)"><path d="M16,4c-5.11328,0 -9.38281,3.16016 -11.125,7.625l1.84375,0.75c1.45703,-3.73437 4.99219,-6.375 9.28125,-6.375c3.24219,0 6.13281,1.58984 7.9375,4h-3.9375v2h7v-7h-2v3.09375c-2.19141,-2.51172 -5.42969,-4.09375 -9,-4.09375zM25.28125,19.625c-1.45703,3.73438 -4.99219,6.375 -9.28125,6.375c-3.27734,0 -6.15625,-1.61328 -7.96875,-4h3.96875v-2h-7v7h2v-3.09375c2.1875,2.48047 5.39453,4.09375 9,4.09375c5.11328,0 9.38281,-3.16016 11.125,-7.625z"></path></g></g>
                  </svg>
                </div>
              </div>
            </div>
            {isScanning && (
              <div className="loading-overlay">
                <div className="spinner"></div>
                <p>Loading, please wait...</p>
              </div>
            )}
            {/* Main UI */}
            {!isScanning && (
              <div>
                  <div className="card-i text-sm">
                    <div className="badge-container">
                      <h2>Contrast Violations</h2>
                      <div className="badge">{autoScanResults.contrastLen}</div>
                    </div>
                    {autoScanResults.contrastViolations.length > 0 ? (
                      <div>
                        {autoScanResults.contrastViolations
                        .filter((violation) => !dismissedViolations.has(violation.layerId))
                        .map((violation, index) => (
                          <div className="grad" key={index} onClick={() => handleLayerSelection(violation.layerId)}>
                            <div className="flex-container">
                              <div className="row">
                                <div className="column" style={{fontStyle: "italic"}}>{violation.frame} {'>'} {violation.layer}</div>
                              </div>
                              <div className="row">
                                <div className="column"><strong>Contrast Ratio:</strong></div>
                                <div className="result">{`${violation.contrastRatio}:1`}</div>
                              </div>
                              <div className="row">
                                <div className="column">{violation.issueDescription}</div>
                              </div>
                            </div>
                            <div className="feature btn text-sm margin-up" tabIndex={0} role="button" onClick={() => handleDetailsContrast(violation)}>
                              Details 
                            </div>
                            <div className="feature btn text-sm margin-up" tabIndex={0} role="button" onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering the layer selection
                                handleDismiss(violation.violationId);
                              }}>
                              Dismiss 
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="grad">No contrast violations found!</p>
                    )}

                  </div>

                  <div className="card-i text-sm">
                    <div className="badge-container">
                      <h2>Touch Target Violations</h2>
                      <div className="badge">{autoScanResults.touchLen}</div>
                    </div>
                    
                    {autoScanResults.touchTargetViolations.length > 0 ? (
                      <div>
                        {autoScanResults.touchTargetViolations.map((violation, index) => (
                          <div className="grad" key={index} onClick={() => handleLayerSelection(violation.layerId)}>
                            <div className="flex-container">
                              <div className="row">
                                <div className="column" style={{fontStyle: "italic"}}>{violation.frame} {'>'} {violation.layer}</div>
                              </div>
                              <div className="row">
                                <div className="column"><strong>Width:</strong></div>
                                <div className="result">{violation.width}px</div>
                              </div>
                              <div className="row">
                                <div className="column"><strong>Height:</strong></div>
                                <div className="result">{violation.height}px</div>
                              </div>
                              <div className="row">
                                <div className="column">{violation.issueDescription}</div>
                              </div>
                            </div>
                            <div className="feature btn text-sm margin-up" tabIndex={0} role="button" onClick={() => handleDetailsTouch(violation)}>
                              Details 
                            </div>
                            <div className="feature btn text-sm margin-up" tabIndex={0} role="button" onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering the layer selection
                                handleDismiss(violation.violationId);
                              }}>
                              Dismiss 
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="grad">No touch target violations found!</p>
                    )}
                  </div>

                </div>
            )}
          </div>
        )}

        {currentPage === "colorContrastPage" && (
          <div>
            <div className="row">
              <div className="label">
                <p className="instruction text-sm">Select a frame/layer to check.</p>
              </div>
              <div className="result text-sm" style={{margin: "10px 0px",}}>
                <div className="svg-container" tabIndex={0} role="button" onClick={() => navigateTo("colorContrastPage")}>
                  <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="25" height="25" viewBox="0,0,256,256">
                    <title>Refresh page</title>
                    <g fill="rgba(230,210,164,1)" fill-rule="nonzero" stroke="none" stroke-width="1" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0" font-family="none" font-weight="none" font-size="none" text-anchor="end" style="mix-blend-mode: normal"><g transform="scale(8,8)"><path d="M16,4c-5.11328,0 -9.38281,3.16016 -11.125,7.625l1.84375,0.75c1.45703,-3.73437 4.99219,-6.375 9.28125,-6.375c3.24219,0 6.13281,1.58984 7.9375,4h-3.9375v2h7v-7h-2v3.09375c-2.19141,-2.51172 -5.42969,-4.09375 -9,-4.09375zM25.28125,19.625c-1.45703,3.73438 -4.99219,6.375 -9.28125,6.375c-3.27734,0 -6.15625,-1.61328 -7.96875,-4h3.96875v-2h-7v7h2v-3.09375c2.1875,2.48047 5.39453,4.09375 9,4.09375c5.11328,0 9.38281,-3.16016 11.125,-7.625z"></path></g></g>
                  </svg>
                </div>
              </div>
            </div>
            <div id="color-contrast-report">
              <p className="heading">WCAG Contrast Ratio</p>
              <p className="check-result">{contrastResults.contrastRatio}</p>
              <div className="color-box-container">
                <div className="color-box" style={{ backgroundColor: `rgb(${foreR}, ${foreG}, ${foreB})`, height: "50px", width: "40%" }} />
                <div className="color-box" style={{ backgroundColor: `rgb(${backR}, ${backG}, ${backB})`, height: "50px", width: "40%" }} />
              </div>
              <div className="row">
                <div className="column-center">Text color</div>
		            <div className="column-center">Background color</div>
              </div>
              <div className="card">
                <h2>If normal text...</h2>
                <hr />
                <div className="flex-container">
                  <div className="row">
                    <div className="label text-sm">AA (minimum 4.5:1)</div>
                    <div className={`result text-sm ${contrastResults.AA_NormalText === "true" ? "pass" : contrastResults.AA_NormalText === "false" ? "fail" : ""}`}>{contrastResults.AA_NormalText === "true" ? "Pass" : contrastResults.AA_NormalText === "false" ? "Fail" : "-"}</div>
                  </div>
                  <div className="row">
                    <div className="label text-sm">AAA (minimum 7:1)</div>
                    <div className={`result text-sm ${contrastResults.AAA_NormalText === "true" ? "pass" : contrastResults.AAA_NormalText === "false" ? "fail" : ""}`}>{contrastResults.AAA_NormalText === "true" ? "Pass" : contrastResults.AAA_NormalText === "false" ? "Fail" : "-"}</div>
                  </div>
                  <div className="row">
                    <p className="column placeholder">
                      *Normal text is approximately 18px
                    </p>
                  </div>
                </div>
              </div>
              <div className="card">
                <h2>If large text...</h2>
                <hr />
                <div className="flex-container">
                  <div className="row">
                    <div className="label text-sm">AA (minimum 3:1)</div>
                    <div className={`result text-sm ${contrastResults.AA_LargeText === "true" ? "pass" : contrastResults.AA_LargeText === "false" ? "fail" : ""}`}>{contrastResults.AA_LargeText === "true" ? "Pass" : contrastResults.AA_LargeText === "false" ? "Fail" : "-"}</div>
                  </div>
                  <div className="row">
                    <div className="label text-sm">AAA (minimum 4.5:1)</div>
                    <div className={`result text-sm ${contrastResults.AAA_LargeText === "true" ? "pass" : contrastResults.AAA_LargeText === "false" ? "fail" : ""}`}>{contrastResults.AAA_LargeText === "true" ? "Pass" : contrastResults.AAA_LargeText === "false" ? "Fail" : "-"}</div>
                  </div>
                  <div className="row">
                    <p className="column placeholder">
                      *Large text is approximately 24px
                    </p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="row">
                  <div className="label">
                      <h2>WCAG Text Color Fix</h2>
                  </div>
                  <div className="result" style={{margin: "10px 0px",}}>
                    <div className="svg-container" onClick={() => setIsPopoverOpen(true)}>
                      <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="20" height="20" viewBox="0 0 50 50"
                      style="fill:#FFFFFF;">
                      <path d="M 25 2 C 12.309295 2 2 12.309295 2 25 C 2 37.690705 12.309295 48 25 48 C 37.690705 48 48 37.690705 48 25 C 48 12.309295 37.690705 2 25 2 z M 25 4 C 36.609824 4 46 13.390176 46 25 C 46 36.609824 36.609824 46 25 46 C 13.390176 46 4 36.609824 4 25 C 4 13.390176 13.390176 4 25 4 z M 25 11 A 3 3 0 0 0 22 14 A 3 3 0 0 0 25 17 A 3 3 0 0 0 28 14 A 3 3 0 0 0 25 11 z M 21 21 L 21 23 L 22 23 L 23 23 L 23 36 L 22 36 L 21 36 L 21 38 L 22 38 L 23 38 L 27 38 L 28 38 L 29 38 L 29 36 L 28 36 L 27 36 L 27 21 L 26 21 L 22 21 L 21 21 z"></path>
                      </svg>
                    </div >
                      {/* Popover Component */}
                      <Popover 
                        message="Invalid means no color can meet the contrast ratio within the RGB color range. We recommend adjusting the foreground or background color instead."
                        isOpen={isPopoverOpen} 
                        onClose={() => setIsPopoverOpen(false)} 
                    />
                  </div>
                </div>
                <hr />
                <div className="flex-container">
                  {isScanning && suggestedResultsII.suggestions ? (
                    <div className="row">
                      <div className="label">
                        <p>Loading, please wait...</p>
                      </div>
                    </div>
                      
                    ) : Array.isArray(suggestedResultsII.suggestions) &&
                    suggestedResultsII.suggestions.length > 0 ? (
                    suggestedResultsII.suggestions.map((suggestion, index) => (
                      <div key={index} className="color-suggestion row">
                        <p className="label text-sm">
                          {suggestion.label}
                        </p>
                        {typeof suggestion.color === "object" ? (
                          <div
                            className="color-box result"
                            style={{
                              backgroundColor: `rgb(${suggestion.color.r}, ${suggestion.color.g}, ${suggestion.color.b})`,
                              height: "40px",
                              width: "30%",
                            }}
                            onClick={() => handleColorBoxClick(suggestion.color)}
                          />
                        ) : (
                          <p className="text-sm result">Invalid</p> // Display text when no color is possible
                        )}
                      </div>
                    ))
                  ) : (
                  <div className="row">
                    <div className="label text-sm">
                      {suggestedResultsII.suggestions}
                    </div>
                  </div>
                    
                  )}
                {/* <hr /> */}
                  <div className="row">
                    <div className="result" onClick={() => navigateTo("settingPage")}>
                      <p className="link" tabIndex={0} role="button">Need custom contrast ratio?</p> 
                    </div>
                  </div>

                  {isColorBoxClicked && selectedColor &&(
                    <div className="row">
                      <div className="column">
                        <div className="feature btn text-sm" tabIndex={0} role="button" style={{marginRight: "10px",}} onClick={() => handleColorApply(selectedColor)} >Apply</div>
                      </div>
                      <div className="column">
                        <div className="feature btn text-sm" tabIndex={0} role="button" onClick={() => handleColorApplyAll(selectedColor, contrastResults.foreColor)}>Apply All</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="info">
              <div className="collapsible" onClick={toggleAboutSection}>
              <h2>About Contrast {isAboutVisible ? '<' : '>'}</h2>
              </div>
              {isAboutVisible && (
                <div className="ins-collapsible card">
                  <p>
                    Color contrast ensures that text is easily readable against its background, which is crucial for accessibility. 
                    The <b>contrast ratio</b> measures the difference in luminance between the foreground (text) and background colors, ranging from
                    1:1 (no contrast) to 21:1 (maximum contrast).
                  </p>

                  <ul>
                    <li>For <strong>normal text</strong> (font size less than 18pt or 14pt bold), WCAG requires:
                      <ul>
                        <li><strong>Level AA</strong>: Minimum contrast ratio of <strong>4.5:1</strong>.</li>
                        <li><strong>Level AAA</strong>: Minimum contrast ratio of <strong>7:1</strong>.</li>
                      </ul>
                    </li>
                    <li>For <strong>large text</strong> (font size at least 18pt or 14pt bold), the requirements are slightly relaxed because larger text is easier to read:
                      <ul>
                        <li><strong>Level AA</strong>: Minimum contrast ratio of <strong>3:1</strong>.</li>
                        <li><strong>Level AAA</strong>: Minimum contrast ratio of <strong>4.5:1</strong>.</li>
                      </ul>
                    </li>
                  </ul>

                  <h3>Purpose:</h3>
                  <p>These guidelines are designed to ensure that people with visual impairments, such as low vision or color blindness, can read and interact with content effectively. By meeting these contrast requirements, designers make their interfaces more inclusive and accessible to a broader audience.</p>
                  <p>For more information, please visit <a href="https://www.w3.org/WAI/WCAG21/quickref/" target="_blank">How to Meet WCAG (Quick Reference)</a></p>
                </div>
              )}
            </div>
          </div>
        )}

        {currentPage === "touchTargetPage" && (
          <div>
            <div className="row">
              <div className="label">
                <p className="instruction text-sm">Select a frame/layer to check.</p>
              </div>
              <div className="result" style={{margin: "10px 0px",}}>
                <div className="svg-container" onClick={() => navigateTo("touchTargetPage")}>
                  <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="25" height="25" viewBox="0,0,256,256">
                    <g fill="rgba(230,210,164,1)" fill-rule="nonzero" stroke="none" stroke-width="1" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0" font-family="none" font-weight="none" font-size="none" text-anchor="end" style="mix-blend-mode: normal"><g transform="scale(8,8)"><path d="M16,4c-5.11328,0 -9.38281,3.16016 -11.125,7.625l1.84375,0.75c1.45703,-3.73437 4.99219,-6.375 9.28125,-6.375c3.24219,0 6.13281,1.58984 7.9375,4h-3.9375v2h7v-7h-2v3.09375c-2.19141,-2.51172 -5.42969,-4.09375 -9,-4.09375zM25.28125,19.625c-1.45703,3.73438 -4.99219,6.375 -9.28125,6.375c-3.27734,0 -6.15625,-1.61328 -7.96875,-4h3.96875v-2h-7v7h2v-3.09375c2.1875,2.48047 5.39453,4.09375 9,4.09375c5.11328,0 9.38281,-3.16016 11.125,-7.625z"></path></g></g>
                  </svg>
                </div>
              </div>
            </div>
            <div id="touch-target-report">
              <div className="touch-preview">
                <div className="preview-box">
                  <div className="preview-content" dangerouslySetInnerHTML={{ __html: touchResults.previewContent }} />
                </div>
              </div>

              <p className="check-result">{touchResults.dimensions}</p>

              <div className="card">
                <h2>WCAG</h2>
                <hr />
                <div className="flex-container">
                  <div className="row text-sm">
                    <div className="label">AA (24px x 24px)</div>
                    <div className={`result ${touchResults.wcagAA === "true" ? "pass" : touchResults.wcagAA === "false" ? "fail" : ""}`}>{touchResults.wcagAA === "true" ? "Pass" : touchResults.wcagAA === "false" ? "Fail" : "-"}</div>
                  </div>
                  <div className="row text-sm">
                    <div className="label">AAA (44px x 44px)</div>
                    <div className={`result ${touchResults.wcagAAA === "true" ? "pass" : touchResults.wcagAAA === "false" ? "fail" : ""}`}>{touchResults.wcagAAA === "true" ? "Pass" : touchResults.wcagAAA === "false" ? "Fail" : "-"}</div>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2>Fix Suggestion</h2>
                <hr />
                {touchResults.wcagAA === "false" || touchResults.wcagAAA === "false" ? (
                  <p className="text-sm">If selected element is interactive, consider increasing the height or width following the recommendations.</p>
                ) : touchResults.wcagAA === "-" || touchResults.wcagAAA === "-" ? (
                  <p className="text-sm">-</p>
                ) : (
                  <p className="text-sm">Height and width are sufficient.</p>
                )}
              </div>

              <div className="card">
                <h2>Other Recommendations</h2>
                <hr />
                <div className="flex-container">
                  <div className="row text-sm">
                    <div className="label">iOS (44px x 44px)*</div>
                    <div className={`result ${touchResults.iosStatus === "true" ? "pass" : touchResults.iosStatus === "false" ? "fail" : ""}`}>{touchResults.iosStatus === "true" ? "Pass" : touchResults.iosStatus === "false" ? "Fail" : "-"}</div>
                  </div>
                  <div className="row text-sm">
                    <div className="label">Android (48px x 48px)*</div>
                    <div className={`result ${touchResults.materialStatus === "true" ? "pass" : touchResults.materialStatus === "false" ? "fail" : ""}`}>{touchResults.materialStatus === "true" ? "Pass" : touchResults.materialStatus === "false" ? "Fail" : "-"}</div>
                  </div>
                  <div className="row text-sm">
                    <div className="label">Microsoft (40px x 40px)*</div>
                    <div className={`result ${touchResults.fluentStatus === "true" ? "pass" : touchResults.fluentStatus === "false" ? "fail" : ""}`}>{touchResults.fluentStatus === "true" ? "Pass" : touchResults.fluentStatus === "false" ? "Fail" : "-"}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="info">
              <div className="collapsible" onClick={toggleAboutSection}>
              <h2 >About Touch Target {isAboutVisible ? '<' : '>'}</h2>
              </div>
              {isAboutVisible && (
                <div className="ins-collapsible card">
                  <p>
                  Touch Target in the context of WCAG compliance ensures that interactive elements like buttons, links, and form controls are large enough to be easily activated by users, particularly on mobile and touch devices. 
                  This is crucial for accessibility because users with motor impairments or those using touch screens need sufficiently sized touch targets to interact with web content effectively.
                  </p>

                  <h3>Touch Target Size for WCAG Compliance (AA and AAA Levels):</h3>
                  <ul>
                    <li><strong>Level AA</strong> (WCAG 2.2): Minimum touch target size of 24x24 pixels</li>
                    <li><strong>Level AAA</strong> (WCAG 2.2): Minimum touch target size of 44x44 pixels</li>
                  </ul>

                  <h3>Other Design Guidelines for Touch Targets:</h3>
                  <ul>
                    <li><strong>Apple (iOS Human Interface Guidelines)</strong>: Minimum target size of <strong>44x44 points</strong>.</li>
                    <li><strong>Material Design (Android)</strong>: Minimum target size of <strong>48x48 dp</strong> (density-independent pixels).</li>
                    <li><strong>Fluent Design (Microsoft)</strong>: Minimum target size of <strong>40x40 epx</strong> (effective pixels).</li>
                  </ul>

                </div>
              )}
            </div>
          </div>
        )}

        {currentPage === "visionSimulatorPage" && (
          <div className="vision-simulator">
            <div className="row">
              <div className="label">
                <p className="instruction text-sm">Select a frame/layer to check.</p>
              </div>
              <div className="result text-sm" style={{margin: "10px 0px",}}>
                <div className="svg-container" tabIndex={0} role="button" onClick={() => navigateTo("visionsimulatorPage")}>
                  <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="25" height="25" viewBox="0,0,256,256">
                    <title>Refresh page</title>
                    <g fill="rgba(230,210,164,1)" fill-rule="nonzero" stroke="none" stroke-width="1" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0" font-family="none" font-weight="none" font-size="none" text-anchor="end" style="mix-blend-mode: normal"><g transform="scale(8,8)"><path d="M16,4c-5.11328,0 -9.38281,3.16016 -11.125,7.625l1.84375,0.75c1.45703,-3.73437 4.99219,-6.375 9.28125,-6.375c3.24219,0 6.13281,1.58984 7.9375,4h-3.9375v2h7v-7h-2v3.09375c-2.19141,-2.51172 -5.42969,-4.09375 -9,-4.09375zM25.28125,19.625c-1.45703,3.73438 -4.99219,6.375 -9.28125,6.375c-3.27734,0 -6.15625,-1.61328 -7.96875,-4h3.96875v-2h-7v7h2v-3.09375c2.1875,2.48047 5.39453,4.09375 9,4.09375c5.11328,0 9.38281,-3.16016 11.125,-7.625z"></path></g></g>
                  </svg>
                </div>
              </div>
            </div>
            <div id="vision-report">
              <div className="preview-container">
                {visionPreviews && Object.values(visionPreviews).some(value => value) ? (
                  <div className="preview">
                    <div className="original">
                      <img src={visionPreviews.original || ''} alt="Original" />
                    </div>
                    <div className="colorblind-preview">
                      <img src={visionPreviews[currentVisionType] || ''} 
                      onError={() => console.error(`Error loading image for ${currentVisionType}`)}/>
                    </div>
                  </div>
                ) : (
                  <div className="preview">
                    <p className="placeholder">No preview available</p>
                  </div>
                )}
              </div>
              <div className="preview-container">
                <div className="original">
                  Original Preview
                </div>
                <div className="colorblind-preview">
                  {currentVisionType === 'original' ? 'Original Preview' : `${currentVisionType.charAt(0).toUpperCase() + currentVisionType.slice(1)} Preview`}
                </div>
              </div>
            </div>
    
            <div className="card">
              <h2>
                Select colorblindness type
              </h2>
              <hr />
              <div className="flex-container">
                <div className="row">
                  <div className="feature column button-width btn" tabIndex={0} role="button" onClick={() => setCurrentVisionType('protanopia')}>Red-Color ColorBlindness (Protanopia)</div>
                  <div className="feature column btn" tabIndex={0} role="button" onClick={() => setCurrentVisionType('deuteranopia')}>Green-Color ColorBlindness (Deuteranopia)</div>
                </div>
                <div className="row">
                  <div className="feature column button-width btn" tabIndex={0} role="button" onClick={() => setCurrentVisionType('tritanopia')}>Blue-Color ColorBlindness (Tritanopia)</div>
                  <div className="feature column btn" tabIndex={0} role="button" onClick={() => setCurrentVisionType('achromatopsia')}>Total ColorBlindness (Achromatopsia)</div>
                </div>
              </div>
            </div>

            <div className="card">
              <h2>Accessibility Issues</h2>
              <hr />

              <div className="flex-container text-sm">
                {Object.keys(visionSuggestions).length > 0 ? (
                  <div>
                    <p style={{marginBottom: "10px",}}>The contrast in elements below may be affected for certain colorblindness simulation:</p>
                    {Object.entries(visionSuggestions).map(([type, nodeNames]) => (
                      <div key={type}>
                        <h3>{`${type.charAt(0).toUpperCase() + type.slice(1)}`}</h3>
                        <ul>
                          {nodeNames.map((nodeName, index) => (
                            <li key={index}>{nodeName}</li>
                          ))}
                        </ul>
                      </div>
                  ))}
                  </div>
                ) : (
                  <p className="column text-sm">No major accessibility issues detected.</p>
                )}
              </div>
            </div>
            
            <div className="info">
              <div className="info">
                <div className="collapsible" onClick={toggleAboutSection}>
                  <h2>
                    About Color Blindness Simulator {isAboutVisible ? '<' : '>'}
                  </h2>
                </div>
                {isAboutVisible && (
                  <div className="ins-collapsible card">
                    <p>
                      This <b>Color Blindness Simulator</b> uses the <b>Brettel (1997) algorithm</b> (adapted from{' '}
                      <a
                        href="https://github.com/MaPePeR/jsColorblindSimulator/blob/master/brettel_colorblind_simulation.js"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        this implementation
                      </a>
                      ) to simulate how images appear to individuals with different types of color vision deficiencies.
                    </p>
                    <p>
                      This simulation is designed for <b>dichromacy</b> (a condition where one of the three cone types is missing)
                      and is <b>not</b> suitable for simulating anomalous trichromacy (where one cone type is altered rather than absent).
                    </p>
                    <h3>Types of Color Vision Deficiencies:</h3>
                    <ul>
                      <li>
                        <strong>Protanopia:</strong> Individuals completely lack the red-sensitive cone. Reds may appear darker or washed out, and the overall color balance shifts.
                      </li>
                      <li>
                        <strong>Deuteranopia:</strong> Individuals are missing the green-sensitive cone, making it difficult to distinguish between greens and reds.
                      </li>
                      <li>
                        <strong>Tritanopia:</strong> Individuals do not have the blue-sensitive cone, causing blues and yellows to appear less distinct or muted.
                      </li>
                      <li>
                        <strong>Achromatopsia:</strong> Complete absence of color vision, resulting in a grayscale perception of images.
                      </li>
                    </ul>
                    <h3>Why Use the Brettel Algorithm?</h3>
                    <p>
                      The Brettel algorithm strikes an excellent balance between simplicity and visual accuracy when simulating dichromatic vision. It efficiently models how missing cone types affect color perception, making it a valuable tool for designers and developers aiming to create accessible and inclusive visuals.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {currentPage === "aboutPage" && (
          <div>
            <div className="card-i">
              <h1>Welcome to Accessibility Evaluator!</h1>

              <p>This plugin is your all-in-one accessibility toolkit for Figma. We help you create designs that are usable and inclusive for everyoneâ€”including people with visual or motor challenges. Hereâ€™s what our plugin does:</p>

              <ul>
                <li>
                  <strong>Color Contrast Checker: </strong>
                  Ensures your text and design elements meet the Web Content Accessibility Guidelines (WCAG) for contrast, making your content easier to read for all users.
                </li>
                <li>
                  <strong>Touch Target Checker: </strong>
                  Verifies that interactive elements (like buttons) are large enough. We use WCAG along with guidelines from iOS, Android, and Microsoft to ensure your designs are comfortable to use on any device.
                </li>
                <li>
                  <strong>Color Blindness Simulator: </strong>
                  Uses the Brettel (1997) algorithm to simulate how your designs appear to people with color vision deficiencies (dichromacy). This helps you understand and adjust your color choices for a broader audience.
                </li>
              </ul>

              <h2>Why WCAG?</h2>
              <p>WCAG is the internationally recognized set of guidelines for creating accessible digital content. By using WCAG standards, our plugin helps you design with best practices in mind, ensuring your work is both beautiful and accessible.</p>

              <p>Whether youâ€™re new to accessibility or an experienced designer, <strong>Accessibility Evaluator</strong> makes it easy to build inclusive designs that everyone can enjoy.</p>
            </div>

            <div class="card-i">
              <h1>What is Accessibility?</h1>
              
              <p>Accessibility in design means making sure that everyone, regardless of their abilities or disabilities, can use and enjoy digital content. This includes people with various physical, visual, auditory, and cognitive challenges. The goal is to create products that everyone can interact with, without barriers.</p>
              
              <h2>Why is Accessibility Important?</h2>
              <p>Imagine if you couldnâ€™t read text because of poor contrast, or if you couldnâ€™t interact with buttons because theyâ€™re too small. Accessibility ensures that all usersâ€”whether they have disabilities or notâ€”can fully engage with your design. It makes your content usable by people with different needs, helping to create a more inclusive web.</p>
              
              <h2>Who Benefits from Accessibility?</h2>
              <p>Accessibility is not just for people with disabilities. Everyone benefits from accessible designs! For example:</p>
              <ul>
                <li><strong>People with visual impairments:</strong> Accessible designs help those with low vision or color blindness better navigate your content.</li>
                <li><strong>People with motor impairments:</strong> Accessible touch targets and easy navigation help users with limited mobility interact with your design.</li>
                <li><strong>People with cognitive impairments:</strong> Clear layouts and readable text help users who may find it difficult to process complex information.</li>
                <li><strong>People in challenging environments:</strong> Sometimes, people are in situations where they canâ€™t focus on small detailsâ€”like being outdoors in bright light. Accessibility ensures that they can still use your design in such environments.</li>
              </ul>

              <p>By considering accessibility in your designs, youâ€™re making sure that no one is left outâ€”creating an experience that everyone can enjoy, no matter their abilities.</p>
          </div>
        </div>
        )}

        {currentPage === "settingPage" && (
          <div>
            <SettingsPage />
          </div>
        )}
      </main>

      {currentPage === "colorContrastPage" && (
        <footer>
          <div className="main-btn">
            <button className="feature border-grad" onClick={() => captureReport("color-contrast-report")}>
              Generate a Report
            </button>
          </div>
        </footer>
      )}

      {currentPage === "touchTargetPage" && (
        <footer>
          <div className="main-btn">
            <button className="feature border-grad" onClick={() => captureReport("touch-target-report")}>
              Generate a Report
            </button>
          </div>
        </footer>
      )}

      {currentPage === "visionSimulatorPage" && (
        <footer>
          <div className="main-btn">
            <button className="feature border-grad" onClick={() => captureReport("vision-report")}>
              Generate a Report
            </button>
          </div>
        </footer>
      )}

    </body>
  );
}


export default render(Plugin)

async function simulateImage(
  dataURL: string,
  simulationType: "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia"
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataURL);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      // Process each pixel.
      for (let i = 0; i < data.length; i += 4) {
        const color = { r: data[i], g: data[i + 1], b: data[i + 2] };
        const simulatedColor = simulateColorBlindnessForColor(color, simulationType);
        data[i] = simulatedColor.r;
        data[i + 1] = simulatedColor.g;
        data[i + 2] = simulatedColor.b;
        // Alpha channel remains unchanged.
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL());
    };
    img.src = dataURL;
  });
}

/**
 * Simulates a color vision deficiency on a given RGB color.
 */
function simulateColorBlindnessForColor(
  color: { r: number; g: number; b: number },
  type: "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia"
): { r: number; g: number; b: number } {
  const srgb: [number, number, number] = [color.r, color.g, color.b];
  let result: [number, number, number];
  switch (type) {
    case "protanopia":
      result = brettel(srgb, "protan", 1.0);
      break;
    case "deuteranopia":
      result = brettel(srgb, "deutan", 1.0);
      break;
    case "tritanopia":
      result = brettel(srgb, "tritan", 1.0);
      break;
    case "achromatopsia":
      result = monochrome_with_severity(srgb, 1.0);
      break;
    default:
      result = srgb;
  }
  return {
    r: Math.round(result[0]),
    g: Math.round(result[1]),
    b: Math.round(result[2])
  };
}

/**
 * Converts a color to its achromatopsic (grayscale) equivalent.
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
 * The Brettel algorithm parameters and simulation function.
 */
type BrettelType = "protan" | "deutan" | "tritan";

interface BrettelParams {
  rgbCvdFromRgb_1: number[];
  rgbCvdFromRgb_2: number[];
  separationPlaneNormal: number[];
}

const brettel_params: Record<BrettelType, BrettelParams> = {
  protan: {
    rgbCvdFromRgb_1: [0.14510, 1.20165, -0.34675, 0.10447, 0.85316, 0.04237, 0.00429, -0.00603, 1.00174],
    rgbCvdFromRgb_2: [0.14115, 1.16782, -0.30897, 0.10495, 0.85730, 0.03776, 0.00431, -0.00586, 1.00155],
    separationPlaneNormal: [0.00048, 0.00416, -0.00464]
  },
  deutan: {
    rgbCvdFromRgb_1: [0.36198, 0.86755, -0.22953, 0.26099, 0.64512, 0.09389, -0.01975, 0.02686, 0.99289],
    rgbCvdFromRgb_2: [0.37009, 0.88540, -0.25549, 0.25767, 0.63782, 0.10451, -0.01950, 0.02741, 0.99209],
    separationPlaneNormal: [-0.00293, -0.00645, 0.00938]
  },
  tritan: {
    rgbCvdFromRgb_1: [1.01354, 0.14268, -0.15622, -0.01181, 0.87561, 0.13619, 0.07707, 0.81208, 0.11085],
    rgbCvdFromRgb_2: [0.93337, 0.19999, -0.13336, 0.05809, 0.82565, 0.11626, -0.37923, 1.13825, 0.24098],
    separationPlaneNormal: [0.03960, -0.02831, -0.01129]
  }
};

// Precompute the sRGB to linearRGB lookup table.
const sRGB_to_linearRGB_Lookup: number[] = new Array(256);
for (let i = 0; i < 256; i++) {
  sRGB_to_linearRGB_Lookup[i] = linearRGB_from_sRGB(i);
}

function linearRGB_from_sRGB(v: number): number {
  const fv = v / 255;
  if (fv < 0.04045) return fv / 12.92;
  return Math.pow((fv + 0.055) / 1.055, 2.4);
}

function sRGB_from_linearRGB(v: number): number {
  if (v <= 0) return 0;
  if (v >= 1) return 255;
  if (v < 0.0031308) return 0.5 + (v * 12.92 * 255);
  return 255 * (Math.pow(v, 1 / 2.4) * 1.055 - 0.055);
}

function brettel(
  srgb: [number, number, number],
  t: BrettelType,
  severity: number
): [number, number, number] {
  // Convert sRGB to linear RGB using our lookup.
  const rgb: [number, number, number] = [
    sRGB_to_linearRGB_Lookup[srgb[0]],
    sRGB_to_linearRGB_Lookup[srgb[1]],
    sRGB_to_linearRGB_Lookup[srgb[2]]
  ];

  const params = brettel_params[t];
  const { separationPlaneNormal, rgbCvdFromRgb_1, rgbCvdFromRgb_2 } = params;
  const dotWithSepPlane =
    rgb[0] * separationPlaneNormal[0] +
    rgb[1] * separationPlaneNormal[1] +
    rgb[2] * separationPlaneNormal[2];

  const rgbCvdFromRgb = dotWithSepPlane >= 0 ? rgbCvdFromRgb_1 : rgbCvdFromRgb_2;
  let rgb_cvd: [number, number, number] = [
    rgbCvdFromRgb[0] * rgb[0] + rgbCvdFromRgb[1] * rgb[1] + rgbCvdFromRgb[2] * rgb[2],
    rgbCvdFromRgb[3] * rgb[0] + rgbCvdFromRgb[4] * rgb[1] + rgbCvdFromRgb[5] * rgb[2],
    rgbCvdFromRgb[6] * rgb[0] + rgbCvdFromRgb[7] * rgb[1] + rgbCvdFromRgb[8] * rgb[2]
  ];

  for (let i = 0; i < 3; i++) {
    rgb_cvd[i] = rgb_cvd[i] * severity + rgb[i] * (1 - severity);
  }

  return [
    sRGB_from_linearRGB(rgb_cvd[0]),
    sRGB_from_linearRGB(rgb_cvd[1]),
    sRGB_from_linearRGB(rgb_cvd[2])
  ];
}