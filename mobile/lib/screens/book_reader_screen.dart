import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class BookReaderScreen extends StatefulWidget {
  final String bookId;
  final String bookTitle;

  const BookReaderScreen({
    super.key,
    required this.bookId,
    required this.bookTitle,
  });

  @override
  State<BookReaderScreen> createState() => _BookReaderScreenState();
}

class _BookReaderScreenState extends State<BookReaderScreen> {
  final _auth = FirebaseAuth.instance;
  final _db = FirebaseFirestore.instance;

  // 현재 열려있는 챕터 인덱스 (-1이면 닫힘)
  int _openChapterIndex = -1;

  @override
  Widget build(BuildContext context) {
    final uid = _auth.currentUser?.uid;
    if (uid == null) {
      return const Scaffold(body: Center(child: Text('로그인이 필요합니다.')));
    }

    return Scaffold(
      backgroundColor: const Color(0xFFFAF9F6),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A3C6E),
        foregroundColor: Colors.white,
        title: Text(
          widget.bookTitle,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        elevation: 0,
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: _db
            .collection('books')
            .doc(widget.bookId)
            .collection('chapters')
            .orderBy('order')
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(color: Color(0xFF1A3C6E)),
            );
          }

          if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.menu_book_outlined, size: 64, color: Color(0xFF1A3C6E)),
                  SizedBox(height: 16),
                  Text(
                    '아직 챕터가 없습니다.',
                    style: TextStyle(fontSize: 16, color: Colors.grey),
                  ),
                ],
              ),
            );
          }

          final chapters = snapshot.data!.docs;

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: chapters.length,
            itemBuilder: (context, index) {
              final chapter = chapters[index].data() as Map<String, dynamic>;
              final title = chapter['title'] ?? '제목 없음';
              final content = chapter['content'] ?? '';
              final isOpen = _openChapterIndex == index;

              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                elevation: isOpen ? 4 : 1,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(
                    color: isOpen ? const Color(0xFF1A3C6E) : Colors.transparent,
                    width: 1.5,
                  ),
                ),
                child: Column(
                  children: [
                    // 챕터 헤더 (클릭하면 열림/닫힘)
                    ListTile(
                      onTap: () {
                        setState(() {
                          _openChapterIndex = isOpen ? -1 : index;
                        });
                      },
                      leading: CircleAvatar(
                        backgroundColor: isOpen
                            ? const Color(0xFF1A3C6E)
                            : const Color(0xFF1A3C6E).withOpacity(0.1),
                        child: Text(
                          '${index + 1}',
                          style: TextStyle(
                            color: isOpen ? Colors.white : const Color(0xFF1A3C6E),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      title: Text(
                        title,
                        style: TextStyle(
                          fontWeight: isOpen ? FontWeight.bold : FontWeight.normal,
                          color: const Color(0xFF1A3C6E),
                          fontSize: 16,
                        ),
                      ),
                      trailing: Icon(
                        isOpen ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                        color: const Color(0xFF1A3C6E),
                      ),
                    ),
                    // 챕터 내용 (열렸을 때만 표시)
                    if (isOpen)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Divider(color: Color(0xFF1A3C6E), thickness: 0.5),
                            const SizedBox(height: 12),
                            Text(
                              content.isNotEmpty ? content : '내용이 없습니다.',
                              style: const TextStyle(
                                fontSize: 15,
                                height: 1.8,
                                color: Color(0xFF333333),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}
