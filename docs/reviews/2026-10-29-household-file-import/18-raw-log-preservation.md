# ビルドログ原文の空白保全

17-build.txt は Vite が出力した原文であり、`[plugin vite:reporter] ` 行末の空白もそのまま保全する。初回 stage 後の `git diff --cached --check` はその行末空白を報告した。原文を改変せず、同じフォルダの `.gitattributes` でこの1ファイルだけ whitespace 検査を無効にする。コード・テスト・他の記録の空白検査は維持する。

原文とのバイト同一性は `/private/tmp/haru-file-import-validation-build.txt` と17-build.txtを比較して確認する。既存レビューの修正・削除はない。
