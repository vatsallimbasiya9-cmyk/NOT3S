import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const sceneContainer = document.getElementById("scene");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);
const camera = new THREE.PerspectiveCamera(
    45,
    sceneContainer.clientWidth / sceneContainer.clientHeight,
    0.1,
    100
);
camera.position.set(0, 0.8, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
renderer.shadowMap.enabled = true;
sceneContainer.appendChild(renderer.domElement);

const hiddenInput = document.getElementById("hiddenInput");

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener("click", (event) => {
    hiddenInput.focus();
    if (!hasStartedTyping) {
        hasStartedTyping = true;
    }
    let targetIdx = pages[currentPage].length;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(pagesMesh);

    if (intersects.length > 0) {
        const hit = intersects[0];
        if (hit.face && hit.face.normal.y > 0.5 && hit.uv) {
            const uv = hit.uv;
            const canvasX = uv.x * 512;
            const canvasY = (1 - uv.y) * 700;

            if (currentLinesData.length > 0) {
                let closestLineIdx = 0;
                let minVerticalDist = Infinity;
                for (let l = 0; l < currentLinesData.length; l++) {
                    let lineY = 55 + l * 30;
                    let dist = Math.abs(canvasY - lineY);
                    if (dist < minVerticalDist) {
                        minVerticalDist = dist;
                        closestLineIdx = l;
                    }
                }
                let lineObj = currentLinesData[closestLineIdx];
                let closestCharPos = 0;
                let minHorizontalDist = Infinity;

                for (let i = 0; i <= lineObj.text.length; i++) {
                    let posX = 90 + ctx.measureText(lineObj.text.substring(0, i)).width;
                    let dist = Math.abs(canvasX - posX);
                    if (dist < minHorizontalDist) {
                        minHorizontalDist = dist;
                        closestCharPos = i;
                    }
                }
                if (lineObj.text.length === 0) {
                    targetIdx = lineObj.indices[0] || 0;
                } else if (closestCharPos < lineObj.text.length) {
                    targetIdx = lineObj.indices[closestCharPos];
                } else {
                    targetIdx = lineObj.indices[lineObj.text.length - 1] + 1;
                }
            }
        }
    }
    targetIdx = Math.max(0, Math.min(pages[currentPage].length, targetIdx));

    hiddenInput.value = pages[currentPage];
    hiddenInput.selectionStart = targetIdx;
    hiddenInput.selectionEnd = targetIdx;

    drawPageText(pages[currentPage]);
    pageTexture.needsUpdate = true;
});
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 3;
controls.maxDistance = 5;
controls.enablePan = false;
controls.target.set(0, 0, 0);
controls.update();

const pageCanvas = document.createElement("canvas");
pageCanvas.width = 512;
pageCanvas.height = 700;
const ctx = pageCanvas.getContext("2d");

const pages = [""];
let currentPage = 0;
let currentLinesData = [];

hiddenInput.value = pages[currentPage];
let cursorVisible = true;
let hasStartedTyping = false;

setInterval(() => {
    cursorVisible = !cursorVisible;
    drawPageText(pages[currentPage]);
    pageTexture.needsUpdate = true;
}, 500);
function drawPageText(text = "Start typing here...") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 2;
    for (let y = 60; y < pageCanvas.height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(470, y);
        ctx.stroke();
    }
    ctx.strokeStyle = "#ffb3b3";
    ctx.beginPath();
    ctx.moveTo(80, 0);
    ctx.lineTo(80, pageCanvas.height);
    ctx.stroke();

    ctx.fillStyle = "#1a1a1a";
    ctx.font = "22px monospace";

    let displayText;
    if (!hasStartedTyping && text === "") {
        displayText = "Click here & type your notes!\nPress Enter for new line.";
    } else {
        displayText = text;
    }
    let selectionStart = 0;
    let selectionEnd = 0;
    let cursorIdx = 0;
    let showCursor = cursorVisible;

    if (text === pages[currentPage]) {
        selectionStart = hiddenInput.selectionStart;
        selectionEnd = hiddenInput.selectionEnd;
        cursorIdx = hiddenInput.selectionStart;
    } else {
        showCursor = false;
    }

    const maxWidth = 390;
    const paragraphs = displayText.split("\n");

    let paraStartIdx = 0;
    const linesToDraw = [];

    paragraphs.forEach((paragraph) => {
        if (paragraph === "") {
            linesToDraw.push({ text: "", indices: [paraStartIdx] });
            paraStartIdx += 1;
            return;
        }
        let line = "";
        let lineIndices = [];
        let tokenOffset = 0;

        let tokens = [];
        let currentWord = "";
        for (let i = 0; i < paragraph.length; i++) {
            let char = paragraph[i];
            if (char === " ") {
                if (currentWord !== "") {
                    tokens.push({ type: "word", text: currentWord });
                    currentWord = "";
                }
                tokens.push({ type: "space", text: " " });
            } else {
                currentWord += char;
            }
        }
        if (currentWord !== "") {
            tokens.push({ type: "word", text: currentWord });
        }

        tokens.forEach((token) => {
            let tokenStartIdx = paraStartIdx + tokenOffset;

            if (token.type === "word") {
                let tempWord = token.text;
                let tempWordStartIdx = tokenStartIdx;
                while (ctx.measureText(tempWord).width > maxWidth) {
                    let cut = tempWord.length;
                    while (ctx.measureText(tempWord.substring(0, cut)).width > maxWidth) {
                        cut--;
                    }

                    if (line !== "") {
                        linesToDraw.push({ text: line, indices: lineIndices });
                        line = "";
                        lineIndices = [];
                    }

                    let cutText = tempWord.substring(0, cut);
                    let cutIndices = [];
                    for (let i = 0; i < cut; i++) {
                        cutIndices.push(tempWordStartIdx + i);
                    }
                    linesToDraw.push({ text: cutText, indices: cutIndices });

                    tempWord = tempWord.substring(cut);
                    tempWordStartIdx += cut;
                }
                if (tempWord.length > 0) {
                    let testLine = line + tempWord;
                    if (ctx.measureText(testLine).width > maxWidth) {
                        if (line !== "") {
                            linesToDraw.push({ text: line, indices: lineIndices });
                        }
                        line = tempWord;
                        lineIndices = [];
                        for (let i = 0; i < tempWord.length; i++) {
                            lineIndices.push(tempWordStartIdx + i);
                        }
                    } else {
                        line = testLine;
                        for (let i = 0; i < tempWord.length; i++) {
                            lineIndices.push(tempWordStartIdx + i);
                        }
                    }
                }
            } else if (token.type === "space") {
                let testLine = line + " ";
                if (ctx.measureText(testLine).width > maxWidth) {
                    if (line !== "") {
                        linesToDraw.push({ text: line, indices: lineIndices });
                    }
                    line = " ";
                    lineIndices = [tokenStartIdx];
                } else {
                    line = testLine;
                    lineIndices.push(tokenStartIdx);
                }
            }
            tokenOffset += token.text.length;
        });
        if (line !== "") {
            linesToDraw.push({ text: line, indices: lineIndices });
        }

        paraStartIdx += paragraph.length + 1;
    });

    if (selectionStart !== selectionEnd) {
        linesToDraw.forEach((lineObj, lIdx) => {
            let currentLineY = 55 + lIdx * 30;
            ctx.fillStyle = "rgba(0, 120, 215, 0.3)";

            for (let i = 0; i < lineObj.text.length; i++) {
                let gIdx = lineObj.indices[i];
                if (gIdx >= selectionStart && gIdx < selectionEnd) {
                    let charX = 90 + ctx.measureText(lineObj.text.substring(0, i)).width;
                    let charW = ctx.measureText(lineObj.text.substring(i, i + 1)).width;
                    ctx.fillRect(charX, currentLineY - 22, charW, 26);
                }
            }
        });
    }
    if (showCursor) {
        let cursorX = 90;
        let cursorY = 55;

        for (let l = 0; l < linesToDraw.length; l++) {
            let lineObj = linesToDraw[l];
            let currentLineY = 55 + l * 30;

            let idx = lineObj.indices.indexOf(cursorIdx);
            if (idx !== -1) {
                cursorX = 90 + ctx.measureText(lineObj.text.substring(0, idx)).width;
                cursorY = currentLineY;
                break;
            }
            if (lineObj.indices.length > 0) {
                let lastCharIdx = lineObj.indices[lineObj.indices.length - 1];
                if (cursorIdx === lastCharIdx + 1) {
                    cursorX = 90 + ctx.measureText(lineObj.text).width;
                    cursorY = currentLineY;
                }
            }
        }
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(cursorX, cursorY - 22, 2, 26);
    }

    ctx.fillStyle = "#1a1a1a";
    ctx.font = "22px monospace";
    linesToDraw.forEach((lineObj, lIdx) => {
        let currentLineY = 55 + lIdx * 30;
        ctx.fillText(lineObj.text, 90, currentLineY);
    });

    currentLinesData = linesToDraw;
}

drawPageText("Click here & type your notes!\nPress Enter for new line.");
const pageTexture = new THREE.CanvasTexture(pageCanvas);

const notebookGroup = new THREE.Group();

const textureLoader = new THREE.TextureLoader();
const coverTexture = textureLoader.load("texture image/notecover.jpg");
coverTexture.colorSpace = THREE.SRGBColorSpace;
coverTexture.flipY = false;
const coverGeo = new THREE.BoxGeometry(2.3, 0.1, 3.1);
const coverMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x1e222a, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0x1e222a, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0x1e222a, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ map: coverTexture }), // BOTTOM = back cover image
    new THREE.MeshStandardMaterial({ color: 0x1e222a, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0x1e222a, roughness: 0.5 })
];
const cover = new THREE.Mesh(coverGeo, coverMaterials);
cover.position.y = -0.06;
notebookGroup.add(cover);

const pageGeo = new THREE.BoxGeometry(2.2, 0.1, 3.0);
const materials = [
    new THREE.MeshStandardMaterial({ color: 0xf0f0f0 }),
    new THREE.MeshStandardMaterial({ color: 0xd0d0d0 }),
    new THREE.MeshStandardMaterial({ map: pageTexture }), // TOP = writing surface
    new THREE.MeshStandardMaterial({ color: 0xf0f0f0 }),
    new THREE.MeshStandardMaterial({ color: 0xf0f0f0 }),
    new THREE.MeshStandardMaterial({ color: 0xf0f0f0 })
];
const pagesMesh = new THREE.Mesh(pageGeo, materials);
notebookGroup.add(pagesMesh);

for (let i = -1.2; i <= 1.2; i += 0.3) {
    const ringGeo = new THREE.TorusGeometry(0.08, 0.02, 8, 16);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(-1.1, 0.05, i);
    notebookGroup.add(ring);
}

notebookGroup.rotation.x = 0.4;
notebookGroup.scale.set(0.85, 0.85, 0.85);
scene.add(notebookGroup);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(4, 5, 3);
scene.add(dirLight);

hiddenInput.addEventListener("input", () => {
    hasStartedTyping = true;
    pages[currentPage] = hiddenInput.value;
    drawPageText(pages[currentPage]);

    if (currentLinesData.length > 22) {
        let splitIdx = currentLinesData[22].indices[0];
        let overflowText = pages[currentPage].substring(splitIdx);
        let cursorIdx = hiddenInput.selectionStart;

        pages[currentPage] = pages[currentPage].substring(0, splitIdx);

        if (currentPage === pages.length - 1) {
            pages.push(overflowText);
            currentPage = pages.length - 1;
        } else {
            pages[currentPage + 1] = overflowText + pages[currentPage + 1];
            currentPage = currentPage + 1;
        }

        hiddenInput.value = pages[currentPage];
        let newCursorIdx = Math.max(0, cursorIdx - splitIdx);
        hiddenInput.selectionStart = newCursorIdx;
        hiddenInput.selectionEnd = newCursorIdx;

        drawPageText(pages[currentPage]);
    }
    pageTexture.needsUpdate = true;
});

hiddenInput.addEventListener("keydown", (event) => {
    if (event.ctrlKey) {
        return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();

        const cursorIdx = hiddenInput.selectionStart;
        const lines = currentLinesData;
        if (lines.length === 0) return;

        let cursorLineIdx = lines.length - 1;
        for (let l = 0; l < lines.length; l++) {
            const lineObj = lines[l];
            const inLine = lineObj.indices.indexOf(cursorIdx) !== -1;
            const atEnd = lineObj.indices.length > 0 &&
                          cursorIdx === lineObj.indices[lineObj.indices.length - 1] + 1;
            if (inLine || atEnd) {
                cursorLineIdx = l;
                break;
            }
        }
        const curLineObj = lines[cursorLineIdx];
        let posInLine = curLineObj.indices.indexOf(cursorIdx);
        if (posInLine === -1) posInLine = curLineObj.text.length;
        const cursorX = 90 + ctx.measureText(curLineObj.text.substring(0, posInLine)).width;

        let targetLineIdx = event.key === "ArrowUp"
            ? Math.max(0, cursorLineIdx - 1)
            : Math.min(lines.length - 1, cursorLineIdx + 1);

        if (targetLineIdx === cursorLineIdx) return;

        const targetLineObj = lines[targetLineIdx];
        let closestCharPos = 0;
        let minDist = Infinity;
        for (let i = 0; i <= targetLineObj.text.length; i++) {
            let posX = 90 + ctx.measureText(targetLineObj.text.substring(0, i)).width;
            let dist = Math.abs(cursorX - posX);
            if (dist < minDist) {
                minDist = dist;
                closestCharPos = i;
            }
        }
        let newIdx;
        if (targetLineObj.text.length === 0) {
            newIdx = targetLineObj.indices[0] || 0;
        } else if (closestCharPos < targetLineObj.text.length) {
            newIdx = targetLineObj.indices[closestCharPos];
        } else {
            newIdx = targetLineObj.indices[targetLineObj.text.length - 1] + 1;
        }
        hiddenInput.selectionStart = newIdx;
        hiddenInput.selectionEnd = newIdx;

        drawPageText(pages[currentPage]);
        pageTexture.needsUpdate = true;
        return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();

        const text = pages[currentPage];
        let pos = hiddenInput.selectionStart;

        if (event.key === "ArrowLeft") {
            pos = Math.max(0, pos - 1);
        } else {
            pos = Math.min(text.length, pos + 1);
        }

        hiddenInput.selectionStart = pos;
        hiddenInput.selectionEnd = pos;

        drawPageText(pages[currentPage]);
        pageTexture.needsUpdate = true;
        return;
    }
});
document.addEventListener("selectionchange", () => {
    if (document.activeElement === hiddenInput) {
        drawPageText(pages[currentPage]);
        pageTexture.needsUpdate = true;
    }
});
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
const newPageButton = document.getElementById("newPage");
const previousPageButton = document.getElementById("previousPage");
const nextPageButton = document.getElementById("nextPage");
newPageButton.addEventListener("click", () => {
    pages.push("");
    currentPage = pages.length - 1;

    hiddenInput.value = pages[currentPage];
    hiddenInput.focus();
    hiddenInput.selectionStart = hiddenInput.value.length;
    hiddenInput.selectionEnd = hiddenInput.value.length;

    drawPageText(pages[currentPage]);
    pageTexture.needsUpdate = true;
});
previousPageButton.addEventListener("click", () => {
    if (currentPage === 0) return;
    currentPage--;

    hiddenInput.value = pages[currentPage];
    hiddenInput.focus();
    hiddenInput.selectionStart = hiddenInput.value.length;
    hiddenInput.selectionEnd = hiddenInput.value.length;

    drawPageText(pages[currentPage]);
    pageTexture.needsUpdate = true;
});

nextPageButton.addEventListener("click", () => {
    if (currentPage >= pages.length - 1) return;
    currentPage++;
    hiddenInput.value = pages[currentPage];
    hiddenInput.focus();
    hiddenInput.selectionStart = hiddenInput.value.length;
    hiddenInput.selectionEnd = hiddenInput.value.length;

    drawPageText(pages[currentPage]);
    pageTexture.needsUpdate = true;
});
window.addEventListener("resize", () => {
    camera.aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
});