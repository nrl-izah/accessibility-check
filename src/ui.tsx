import { render } from '@create-figma-plugin/ui'
import { h } from 'preact'
import { useState } from 'preact/hooks'

import '!./output.css'

function Plugin () {
  const [currentPage, setCurrentPage] = useState("homePage");
  const [contrastResults, setContrastResults] = useState({
    contrastRatio: "0:0",
    foreColor: { r: 255, g: 255, b: 255 },
    backColor: { r: 255, g: 255, b: 255 },
    AA_NormalText: "-",
    AAA_NormalText: "-",
    AA_LargeText: "-",
    AAA_LargeText: "-",
  });
  const [touchResults, setTouchResults] = useState({
    previewContent: `<p class="placeholder">No preview available</p>`,
    width: 0,
    height: 0,
    dimensions: "0px × 0px",
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


  const pageTitles: { [key: string]: string } = {
    homePage: "Accessibility Evaluator",
    colorContrastPage: "Color Contrast",
    touchTargetPage: "Touch Target",
    visionSimulatorPage: "Colorblind Simulator",
  };

  const navigateTo = (page: string) => {
    setCurrentPage(page);
    if (page === "colorContrastPage") {
      parent.postMessage({ pluginMessage: { type: "start-color-contrast" } }, "*");
    } else if (page === "touchTargetPage") {
      parent.postMessage({ pluginMessage: { type: "start-touch-target" } }, "*");
    } else if (page === "visionSimulatorPage") {
      parent.postMessage({ pluginMessage: { type: "start-vision-simulator" } }, "*");
    } 
  };

  const handleBackButton = () => {
    if (currentPage === "colorContrastPage") {
      setContrastResults({
        contrastRatio: "0:0",
        foreColor: { r: 255, g: 255, b: 255 },
        backColor: { r: 255, g: 255, b: 255 },
        AA_NormalText: "-",
        AAA_NormalText: "-",
        AA_LargeText: "-",
        AAA_LargeText: "-",
      });
    } else if (currentPage === "touchTargetPage") {
      setTouchResults({
        previewContent: `<p class="placeholder">No preview available</p>`,
        width: 0,
        height: 0,
        dimensions: "0px × 0px",
        wcagAA: "-",
        wcagAAA: "-",
        iosStatus: "-",
        materialStatus: "-",
        fluentStatus: "-",
      });
    } else if (currentPage === "visionSimulatorPage") {
      setVisionPreviews({
        original: null,
        protanopia: null,
        deuteranopia: null,
        tritanopia: null,
        achromatopsia: null,
      });
    } 
    setCurrentPage("homePage");
  };

  // Directly use the RGB values in your styles
  const { r: foreR, g: foreG, b: foreB } = contrastResults.foreColor;
  const { r: backR, g: backG, b: backB } = contrastResults.backColor;

  window.onmessage = (event) => {
    const msg = event.data.pluginMessage;
    if (msg.type === "contrast-results") {
      const { contrastRatio, foregroundColor, backgroundColor, AA_NormalText, AAA_NormalText, AA_LargeText, AAA_LargeText } = msg.data;
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
        dimensions: `${width}px × ${height}px`,
        wcagAA: wcagAA,
        wcagAAA: wcagAAA,
        iosStatus: ios,
        materialStatus: material,
        fluentStatus: fluent,
      });
    } else if (msg.type === "vision-results") {
      const { encodedImage, protanopia, deuteranopia, tritanopia, achromatopsia } = msg.data;

      setVisionPreviews({
        original: encodedImage,
        protanopia: protanopia,
        deuteranopia: deuteranopia,
        tritanopia: tritanopia,
        achromatopsia:  achromatopsia,
      });
      setCurrentVisionType('original');

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
          <div className="main-btn">
            <button className="feature border-grad" onClick={() => navigateTo("colorContrastPage")}>Color Contrast</button>
            <button className="feature border-grad" onClick={() => navigateTo("touchTargetPage")}>Touch Target</button>
            <button className="feature border-grad" onClick={() => navigateTo("visionSimulatorPage")}>Vision Simulator</button>
          </div>
        )}

        {currentPage === "colorContrastPage" && (
          <div>
            <p className="check-result">{contrastResults.contrastRatio}</p>
            <div className="color-box-container">
              <div className="color-box" style={{ backgroundColor: `rgb(${foreR}, ${foreG}, ${foreB})`, height: "50px", width: "40%" }} />
              <div className="color-box" style={{ backgroundColor: `rgb(${backR}, ${backG}, ${backB})`, height: "50px", width: "40%" }} />
            </div>
            <div className="card">
              <h2>Normal text (14pt)</h2>
              <div className="flex-container">
                <div className="row">
                  <div className="label">AA (at least 4.5:1)</div>
                  <div className="result">{contrastResults.AA_NormalText === "true" ? "Pass" : contrastResults.AA_NormalText === "false" ? "Fail" : "-"}</div>
                </div>
                <div className="row">
                  <div className="label">AAA (at least 7:1)</div>
                  <div className="result">{contrastResults.AAA_NormalText === "true" ? "Pass" : contrastResults.AAA_NormalText === "false" ? "Fail" : "-"}</div>
                </div>
              </div>
            </div>
            <div className="card">
              <h2>Large text (18pt)</h2>
              <div className="flex-container">
                <div className="row">
                  <div className="label">AA (at least 3:1)</div>
                  <div className="result">{contrastResults.AA_LargeText === "true" ? "Pass" : contrastResults.AA_LargeText === "false" ? "Fail" : "-"}</div>
                </div>
                <div className="row">
                  <div className="label">AAA (at least 4.5:1)</div>
                  <div className="result">{contrastResults.AAA_LargeText === "true" ? "Pass" : contrastResults.AAA_LargeText === "false" ? "Fail" : "-"}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentPage === "touchTargetPage" && (
          <div>
            <div className="touch-preview">
              <div className="preview-box">
                <div className="preview-content" dangerouslySetInnerHTML={{ __html: touchResults.previewContent }} />
              </div>
            </div>

            <p className="check-result">{touchResults.dimensions}</p>

            <div className="card">
              <h2>WCAG</h2>
              <div className="flex-container">
                <div className="row">
                  <div className="label">AA (24px x 24px)</div>
                  <div className="result">{touchResults.wcagAA === "true" ? "Pass" : touchResults.wcagAA === "false" ? "Fail" : "-"}</div>
                </div>
                <div className="row">
                  <div className="label">AAA (44px x 44px)</div>
                  <div className="result">{touchResults.wcagAAA === "true" ? "Pass" : touchResults.wcagAAA === "false" ? "Fail" : "-"}</div>
                </div>
              </div>
            </div>

            {/* Other Recommendations Section */}
            <div className="card">
              <h2>Other Recommendations</h2>
              <div className="flex-container">
                <div className="row">
                  <div className="label">Apple</div>
                  <div className="result">{touchResults.iosStatus === "true" ? "Pass" : touchResults.iosStatus === "false" ? "Fail" : "-"}</div>
                </div>
                <div className="row">
                  <div className="label">Material Design (Android)</div>
                  <div className="result">{touchResults.materialStatus === "true" ? "Pass" : touchResults.materialStatus === "false" ? "Fail" : "-"}</div>
                </div>
                <div className="row">
                  <div className="label">Fluent Design (Microsoft)</div>
                  <div className="result">{touchResults.fluentStatus === "true" ? "Pass" : touchResults.fluentStatus === "false" ? "Fail" : "-"}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentPage === "visionSimulatorPage" && (
          <div className="vision-simulator">
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
      
            <div className="flex-container">
              <div className="row">
                <button className="feature column button-width" onClick={() => setCurrentVisionType('protanopia')}>Protanopia</button>
                <button className="feature column button-width" onClick={() => setCurrentVisionType('deuteranopia')}>Deuteranopia</button>
              </div>
              <div className="row">
                <button className="feature column button-width" onClick={() => setCurrentVisionType('tritanopia')}>Tritanopia</button>
                <button className="feature column button-width" onClick={() => setCurrentVisionType('achromatopsia')}>Achromatopsia</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </body>
  );
}

export default render(Plugin)
