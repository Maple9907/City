# GCITY 3D - Thay đổi so với bản gốc

## Nhân vật mới (js/character.js, file mới)
- Chibi: mắt có tròng + điểm sáng, lông mày, mũi, miệng cười, má hồng, tai
- 8 kiểu tóc, 6 kiểu trang phục, phụ kiện (kính, kính râm, mũ lưỡi trai, mũ len, tai nghe, băng đô, nơ, balo)
- Tay có khuỷu + bàn tay; chân có đầu gối; giày đi theo chân
- Viền toon (inverted hull); mỗi bộ phận bake thành 1 mesh vertex-color
- Animation: thở, chớp mắt, tóc đung đưa, đi/chạy mượt, ngồi đúng chiều (bản gốc gập chân ra sau)
- Màn chọn nhân vật dùng ảnh 3D thật (GChar.preview), có fallback 2D nếu không có WebGL
- Sửa: actionT bị cộng 2 lần (game.js) làm emote chạy nhanh gấp đôi

## Camera (js/three-scene.js)
- Bám nhân vật có làm mượt, không phụ thuộc FPS (kể cả hiệu ứng nút 🎥)
- Không ra ngoài rìa đảo; zoom tối đa 110
- Camera nằm trong tòa nhà/cây/đồi => kéo lại trước vật cản
- Tòa nhà/cây/đài phun nằm giữa camera và nhân vật => làm mờ (alpha 0.25)
- Nhãn mini game mờ khi đứng gần; viên ngọc và nhãn nâng cao, không che mặt
- Phím Q/R xoay camera (E vẫn là tương tác)

## Chưa đụng tới
- three.js r128 (vẫn còn cảnh báo flatShading), cây vòng ngoài đảo vẫn đi xuyên được
