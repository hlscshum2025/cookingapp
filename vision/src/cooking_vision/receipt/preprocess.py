from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


@dataclass
class PreprocessResult:
    original:np.ndarray
    normalized:np.ndarray
    grayscale:np.ndarray
    binary:np.ndarray
    document_found:bool


def read_image(path:str|Path)->np.ndarray:
    """Read Windows paths containing Chinese or German characters reliably."""
    source=Path(path)
    if not source.is_file():
        raise FileNotFoundError(f"Image does not exist: {source}")
    data=np.fromfile(source,dtype=np.uint8)
    image=cv2.imdecode(data,cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"OpenCV cannot decode this image: {source}")
    return image


def write_image(path:str|Path,image:np.ndarray)->Path:
    destination=Path(path)
    destination.parent.mkdir(parents=True,exist_ok=True)
    suffix=destination.suffix.lower() or ".png"
    ok,encoded=cv2.imencode(suffix,image)
    if not ok:
        raise ValueError(f"OpenCV cannot encode image as {suffix}")
    encoded.tofile(destination)
    return destination


def _resize(image:np.ndarray,max_side:int)->np.ndarray:
    height,width=image.shape[:2]
    longest=max(height,width)
    if longest<=max_side:
        return image.copy()
    scale=max_side/longest
    return cv2.resize(image,(round(width*scale),round(height*scale)),interpolation=cv2.INTER_AREA)


def _order_points(points:np.ndarray)->np.ndarray:
    points=points.astype("float32")
    ordered=np.zeros((4,2),dtype="float32")
    sums=points.sum(axis=1)
    differences=np.diff(points,axis=1).reshape(-1)
    ordered[0]=points[np.argmin(sums)]
    ordered[2]=points[np.argmax(sums)]
    ordered[1]=points[np.argmin(differences)]
    ordered[3]=points[np.argmax(differences)]
    return ordered


def _warp_document(image:np.ndarray,points:np.ndarray)->np.ndarray:
    top_left,top_right,bottom_right,bottom_left=_order_points(points)
    width=max(np.linalg.norm(bottom_right-bottom_left),np.linalg.norm(top_right-top_left))
    height=max(np.linalg.norm(top_right-bottom_right),np.linalg.norm(top_left-bottom_left))
    if width<80 or height<120:
        return image
    target=np.array([[0,0],[width-1,0],[width-1,height-1],[0,height-1]],dtype="float32")
    matrix=cv2.getPerspectiveTransform(np.array([top_left,top_right,bottom_right,bottom_left]),target)
    return cv2.warpPerspective(image,matrix,(round(width),round(height)))


def _find_receipt_quad(image:np.ndarray)->np.ndarray|None:
    gray=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)
    blurred=cv2.GaussianBlur(gray,(5,5),0)
    edges=cv2.Canny(blurred,50,160)
    edges=cv2.morphologyEx(edges,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8),iterations=2)
    contours,_=cv2.findContours(edges,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
    image_area=image.shape[0]*image.shape[1]
    for contour in sorted(contours,key=cv2.contourArea,reverse=True)[:12]:
        if cv2.contourArea(contour)<image_area*.18:
            continue
        perimeter=cv2.arcLength(contour,True)
        polygon=cv2.approxPolyDP(contour,.02*perimeter,True)
        if len(polygon)==4:
            return polygon.reshape(4,2)
    return None


def preprocess_receipt(path:str|Path,max_side:int=2200)->PreprocessResult:
    original=read_image(path)
    resized=_resize(original,max_side)
    quad=_find_receipt_quad(resized)
    document_found=quad is not None
    normalized=_warp_document(resized,quad) if quad is not None else resized
    grayscale=cv2.cvtColor(normalized,cv2.COLOR_BGR2GRAY)
    grayscale=cv2.createCLAHE(clipLimit=2.0,tileGridSize=(8,8)).apply(grayscale)
    grayscale=cv2.fastNlMeansDenoising(grayscale,None,10,7,21)
    binary=cv2.adaptiveThreshold(grayscale,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY,31,15)
    return PreprocessResult(original=original,normalized=normalized,grayscale=grayscale,binary=binary,document_found=document_found)


def save_preprocess_stages(result:PreprocessResult,output_dir:str|Path)->list[Path]:
    directory=Path(output_dir)
    return [
        write_image(directory/"01_original.jpg",result.original),
        write_image(directory/"02_normalized.jpg",result.normalized),
        write_image(directory/"03_grayscale.png",result.grayscale),
        write_image(directory/"04_binary.png",result.binary),
    ]
