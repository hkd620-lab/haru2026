# 글자 크기·조작 종료 보조 기록

{
  "font_original_percent": 100,
  "font_test_percent": 113,
  "font_restored_percent": 100,
  "setting_100_screen": "screen-040.png",
  "setting_113_screen": "screen-041.png",
  "portrait_113_screen": "screen-043.png",
  "restoration_screen": "screen-049.png",
  "setting_evidence_hashes": {
    "screen-040.png": "54bbbf5373a60db9933dad5327a756c07c2dede7251f80ea15c0e93911589a43",
    "screen-041.png": "b3ccfcaf327450b84d420ee4c957adbd051ab8c6acc902243a8709afc633be40",
    "screen-043.png": "eb4753204e549ad554ed39bbba2db06ba983ea4365ef3d07ca3a60bc53f9e950",
    "screen-049.png": "c22af74d5bdc41e62e265d4bdbdbe0d3970668ec1b4685f1913efea9d9ee23b2"
  },
  "note": "100%와 113%에서 사진만 있는 페이지의 원본 캡처 바이트는 동일했다. 043은 별도 adb screencap으로 생성했고 복사하지 않았다. 글자 크기 설정 변경은 별도 040·041 화면의100/113%로 확인했으며, 사진 전용 페이지가 동일하게 렌더링되는 관찰을 기록한다. 렌더링이 같은 원인 자체는 추정하지 않는다. 독립 검토2의 비차단 지적을 이 보조 기록으로 보완한다.",
  "cleanup": "font restored to100%, helper session closed, local server stopped, adb reverse tcp9184 removed, other device task notified"
}
